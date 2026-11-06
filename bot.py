import os
import sys
import io
import asyncio
import logging
import discord
from discord.ext import commands

# 윈도우 콘솔 UTF-8 인코딩 보장
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import config
from google_sheet import GoogleSheetManager
from ocr_scanner import NicknameScanner
from rapidfuzz import fuzz, process

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("DokkaebiBot")

# 디스코드 인텐트 설정
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix=config.COMMAND_PREFIX, intents=intents)
sheet_mgr = GoogleSheetManager()
scanner = NicknameScanner()

SHEET_PUBLIC_URL = "https://docs.google.com/spreadsheets/d/1HKKUt_nW6H01moxJwmjsdjGnEwOrKHj9Cy-AjYFWUC4/edit?gid=0#gid=0"

def _post_to_web_sync(payload: dict):
    import requests
    urls = [f"{config.WEB_SITE_URL}/api/attendance"]
    if "localhost" not in config.WEB_SITE_URL:
        urls.append("http://localhost:3000/api/attendance")
    for url in urls:
        for attempt in range(2):
            try:
                res = requests.post(url, json=payload, timeout=20)
                if res.ok:
                    break
            except Exception as e:
                if "localhost" not in url and attempt == 1:
                    logger.warning(f"웹사이트 동기화 재시도 실패 ({url}): {e}")

async def sync_to_website(payload: dict):
    await asyncio.to_thread(_post_to_web_sync, payload)

# 4대 컨텐츠 키워드 매핑
CONTENT_KEYWORDS = {
    "요신": "요신 토벌령",
    "토벌": "요신 토벌령",
    "결계": "결계지 방어",
    "결계지": "결계지 방어",
    "미혹": "미혹의 정원",
    "정원": "미혹의 정원",
    "신기": "신기 쟁탈전",
    "쟁탈": "신기 쟁탈전",
}

@bot.event
async def on_ready():
    logger.info("=" * 50)
    logger.info(f"🤖 봇 로그인 성공: {bot.user.name} (ID: {bot.user.id})")
    guild_names = [g.name for g in bot.guilds]
    logger.info(f"🏰 참여 중인 서버({len(guild_names)}개): {', '.join(guild_names)}")
    logger.info("=" * 50)
    await bot.change_presence(activity=discord.Game(name="외길 문파 용맹의 증표 집계 (!도움말)"))

@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    # 첨부파일 중 이미지 확인
    image_attachments = [
        att for att in message.attachments
        if any(att.filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"])
    ]

    if image_attachments:
        detected_content = ""
        msg_text = message.content or ""
        for kw, full_name in CONTENT_KEYWORDS.items():
            if kw in msg_text:
                detected_content = full_name
                break

        # [필수 검증] 컨텐츠 키워드가 없으면 안내 카드 띄우고 즉시 중단!
        if not detected_content:
            embed_warn = discord.Embed(
                title="⚠️ 참여 컨텐츠 이름을 함께 적어주세요!",
                description="어떤 컨텐츠에 참여한 스크린샷인지 확인되지 않았습니다.\n"
                            "사진을 올리실 때 **컨텐츠 이름**을 메시지에 꼭 적어주세요!\n\n"
                            "**[인식 가능한 컨텐츠 키워드]**\n"
                            "• `요신` (1. 요신 토벌령)\n"
                            "• `결계` (2. 결계지 방어)\n"
                            "• `미혹` (3. 미혹의 정원)\n"
                            "• `신기` (4. 신기 쟁탈전)\n\n"
                            "💡 **예시**: 사진과 함께 `신기` 또는 `신기 쟁탈전 완료` 라고 적어서 다시 업로드해 주세요.",
                color=discord.Color.orange()
            )
            embed_warn.set_footer(text="컨텐츠명이 정확히 입력되어야 구글 시트 해당 칸에 체크(☑)됩니다.")
            await message.reply(embed=embed_warn)
            return

        for attachment in image_attachments:
            try:
                await message.add_reaction("👀")
            except Exception:
                pass

            content_label = f"[{detected_content}] "
            status_msg = await message.reply(f"🔍 **{content_label}스크린샷에서 문파원 닉네임을 분석하는 중입니다...**")
            
            try:
                # 1. 시트에서 현재 등록된 문파원 목록 가져오기
                members = await sheet_mgr.get_all_members()
                member_names = list(members.keys())

                if not member_names:
                    await status_msg.edit(
                        content="⚠️ **구글 시트에 등록된 문파원 명단이 비어있습니다.**\n"
                                "구글 시트 Apps Script에서 `setupDokkaebiSheet`를 실행해주세요."
                    )
                    continue

                # 2. 이미지 다운로드 및 Gemini Vision 인식
                image_bytes = await attachment.read()
                detected_names = await scanner.scan_image(image_bytes, member_names)

                if not detected_names:
                    await status_msg.edit(
                        content="⚠️ **스크린샷에서 등록된 문파원 닉네임을 찾지 못했습니다.**\n"
                                "💡 문파원 닉네임이 화면에 명확히 보이는지 확인해주세요."
                    )
                    try:
                        await message.add_reaction("❓")
                    except Exception:
                        pass
                    continue

                # 분신 등록 여부 자동 판별 (요신/결계지 등)
                is_clone = any(k in msg_text for k in ["분신", "분신등록", "자동"])
                part_type = "CLONE" if is_clone else "MANUAL"
                part_badge = "👤 분신 등록 (+0.25P)" if is_clone else "⚔️ 직접 수동 참가 (+1.0P)"

                # 3. 구글 시트에 참여 횟수 +1 반영 (컨텐츠 체크박스 체크)
                updated, unknown = await sheet_mgr.add_participation(detected_names, detected_content)

                # 4. 웹사이트 API로 출석 & 포인트(수동 1.0P / 분신 0.25P) 실시간 동기화
                await sync_to_website({"names": detected_names, "content": detected_content, "type": part_type})

                # 5. 결과 디스코드 임베드로 전송
                title_text = f"⚔️ 도깨비의 세계 외길 문파 참여 집계 완료"
                if detected_content:
                    title_text += f" ({detected_content})"

                embed = discord.Embed(
                    title=title_text,
                    description=f"업로드된 스크린샷에서 총 **{len(updated)}명**의 참여가 확인되었습니다!\n"
                                f"• 참여 형태: **{part_badge}**",
                    color=discord.Color.green()
                )
                
                # 앞에 1. 2. 3. 번호 붙이기 및 총 인원 표시
                updated_lines = [f"{idx}. {name}" for idx, name in enumerate(updated, start=1)]
                updated_text = "\n".join(updated_lines)
                if len(updated_text) > 1024:
                    updated_text = "\n".join(updated_lines[:25]) + f"\n...외 {len(updated_lines) - 25}명"
                embed.add_field(name=f"✅ 참여 체크된 문파원 (총 {len(updated)}명)", value=updated_text, inline=False)

                if unknown:
                    unknown_text = ", ".join(unknown)
                    embed.add_field(name="❓ 미등록 인원", value=unknown_text, inline=False)

                embed.add_field(
                    name="🌐 외길 문파 웹사이트",
                    value=f"[👉 실시간 출석 & 경매 분배 포털 열기]({config.WEB_SITE_URL})",
                    inline=False
                )
                embed.set_footer(text="구글 시트 및 외길 문파 웹사이트에 실시간 반영되었습니다. 경매 낙찰 시 포인트 비례 자동 분배됩니다.")
                await status_msg.edit(content=None, embed=embed)
                try:
                    await message.add_reaction("✅")
                except Exception:
                    pass

            except Exception as e:
                logger.error(f"스크린샷 처리 오류: {e}")
                await status_msg.edit(content=f"❌ 처리 중 오류가 발생했습니다: {e}")
                try:
                    await message.add_reaction("❌")
                except Exception:
                    pass

    await bot.process_commands(message)

# ==========================================
# 안내문(임베드) 생성 헬퍼 함수
# ==========================================

def get_rules_embed():
    embed = discord.Embed(
        title="⚖️ 도깨비의 세계 [외길] 문파 주간 컨텐츠 & 용맹의 증표 분배 규칙",
        description="우리 외길 문파는 **주 4회 필수 컨텐츠 참여도에 비례**하여 용맹의 증표를 공평하게 분배합니다.",
        color=discord.Color.gold()
    )
    embed.add_field(
        name="⚔️ 매주 체크하는 4대 컨텐츠",
        value="1️⃣ **요신 토벌령**\n"
              "2️⃣ **결계지 방어**\n"
              "3️⃣ **미혹의 정원**\n"
              "4️⃣ **신기 쟁탈전**",
        inline=False
    )
    embed.add_field(
        name="📌 분배 공식",
        value="```\n개인 분배 증표 = (개인 참여 횟수 ÷ 문파 총 참여 횟수) × 총 용맹의 증표\n```",
        inline=False
    )
    embed.add_field(
        name="💡 쉬운 예시 (총 증표가 2,500개일 때)",
        value="• 4명 참여 중 3명이 **1회**, 1명이 **2회** 참여 시 (총 5회 참여):\n"
              "  - 1회당 단가: `2,500 ÷ 5 = 500개`\n"
              "  - ➔ 1회 참여자 3명: **각 500개 지급**\n"
              "  - ➔ 2회 참여자 1명: **1,000개 지급**",
        inline=False
    )
    embed.add_field(
        name="🪙 소수점 자투리 증표",
        value="나누어떨어지지 않는 소수점 잔여 증표는 **문파 금고에 적립**되어 다음 분배에 합산됩니다.",
        inline=False
    )
    return embed

def get_sheet_embed():
    embed = discord.Embed(
        title="📊 도깨비의 세계 [외길] 문파 참여 & 분배 관리 시트",
        description="아래 링크를 통해 실시간 참여 횟수와 예상 분배 용맹의 증표를 확인하실 수 있습니다.",
        color=discord.Color.blue(),
        url=SHEET_PUBLIC_URL
    )
    embed.add_field(name="🔗 관리 시트 바로가기", value=f"[👉 구글 스프레드시트 열기]({SHEET_PUBLIC_URL})", inline=False)
    embed.add_field(name="💡 안내", value="• 봇이 스크린샷을 인식하면 체크박스(☑)가 자동으로 체크됩니다.\n• 문파장 정산 시 총 용맹의 증표 수량을 입력하면 분배액이 자동 계산됩니다.", inline=False)
    return embed

def get_cert_embed():
    embed = discord.Embed(
        title="📸 주간 4대 컨텐츠 참여 인증 스크린샷 채널",
        description="컨텐츠 진행 후 참여 화면을 캡처해서 이 채널에 올려주세요!",
        color=discord.Color.green()
    )
    embed.add_field(
        name="📝 참여 인증 방법",
        value="1. **요신 토벌령 / 결계지 방어 / 미혹의 정원 / 신기 쟁탈전** 참여 화면을 캡처합니다.\n"
              "2. 이 채널에 이미지를 업로드합니다. (메시지에 `요신`, `결계`, `미혹`, `신기`를 함께 적어주시면 해당 컨텐츠에 정확히 체크됩니다!)\n"
              "3. 봇이 화면 속 문파원 닉네임을 자동 감지하여 시트에 **체크(☑)**를 반영합니다!\n"
              "4. 감지가 완료되면 봇이 `✅` 반응과 함께 집계 결과를 안내합니다.",
        inline=False
    )
    return embed

def get_admin_embed():
    embed = discord.Embed(
        title="🛠️ 문파장 전용 봇 제어 안내",
        description="이 채널은 문파장 및 운영진 전용 채널입니다. 봇 명령어를 사용해 문파원을 관리하세요.",
        color=discord.Color.dark_red()
    )
    embed.add_field(name="!현황", value="모든 문파원의 누적 참여 횟수 및 순위 확인", inline=False)
    embed.add_field(name="!문파원추가 [닉네임]", value="신규 문파원을 시트에 등록 (예: `!문파원추가 홍길동`)", inline=False)
    embed.add_field(name="!문파원삭제 [닉네임]", value="탈퇴/추방된 문파원을 시트에서 행 삭제 (예: `!문파원삭제 홍길동`)", inline=False)
    embed.add_field(name="!수동추가 [닉네임] [요신/결계/미혹/신기]", value="스크린샷 누락/보정 시 해당 컨텐츠 수동 체크 (예: `!수동추가 홍길동 신기`)", inline=False)
    embed.add_field(name="!초기화", value="주간 분배 정산 완료 후 전원 참여 횟수 0으로 리셋", inline=False)
    embed.add_field(name="!채널업데이트", value="새 채널 생성 없이, 기존 채널들의 안내 카드를 최신 내용으로 갱신", inline=False)
    return embed

def is_manager_or_admin(ctx):
    """현재 모든 유저가 자유롭게 명령어 사용 가능"""
    return True

# ==========================================
# 기존 채널 갱신 명령어 (중복 생성 없이 내용만 업데이트!)
# ==========================================

@bot.command(name="채널업데이트", aliases=["안내업데이트", "공지업데이트", "업데이트"])
@commands.check(is_manager_or_admin)
async def cmd_update_guides(ctx):
    """[관리자 전용] 새 채널을 만들지 않고, 이미 생성된 채널들의 안내 카드(임베드)만 최신 내용으로 업데이트합니다."""
    guild = ctx.guild
    status_msg = await ctx.send("🔄 **기존 채널들의 안내 카드를 최신 내용으로 업데이트하고 있습니다...**")

    updated_count = 0

    # 채널 탐색 헬퍼 (이름에 키워드가 포함된 첫 번째 텍스트 채널)
    def find_channel(kw):
        for ch in guild.text_channels:
            if kw in ch.name:
                return ch
        return None

    # 1. 분배 규칙 안내 채널 업데이트
    ch_rules = find_channel("분배-규칙") or find_channel("규칙")
    if ch_rules:
        await ch_rules.send(embed=get_rules_embed())
        updated_count += 1

    # 2. 실시간 분배시트 채널 업데이트
    ch_sheet = find_channel("분배시트") or find_channel("시트")
    if ch_sheet:
        await ch_sheet.send(embed=get_sheet_embed())
        updated_count += 1

    # 3. 스크린샷 인증 채널 업데이트
    ch_cert = find_channel("스크린샷") or find_channel("인증")
    if ch_cert:
        await ch_cert.send(embed=get_cert_embed())
        updated_count += 1

    # 4. 운영진 채널 업데이트
    ch_admin = find_channel("봇-제어") or find_channel("운영진")
    if ch_admin:
        await ch_admin.send(embed=get_admin_embed())
        updated_count += 1

    await status_msg.edit(
        content=f"🎉 **총 {updated_count}개 채널의 안내 카드가 최신 내용(외길 문파 & 용맹의 증표)으로 업데이트되었습니다!**\n"
                f"(새 채널은 생성되지 않았습니다)"
    )

# ==========================================
# 채널 세팅 (중복 방지: 이미 있으면 기존 채널 재사용)
# ==========================================

@bot.command(name="채널세팅", aliases=["서버세팅", "채널꾸미기", "서버꾸미기"])
@commands.has_permissions(administrator=True)
async def cmd_setup_channels(ctx):
    """[관리자 전용] 채널이 없을 때만 생성하고, 이미 있으면 기존 채널에 최신 안내문만 올립니다."""
    guild = ctx.guild
    status_msg = await ctx.send("🏗️ **채널 구조를 확인하고 안내문을 업데이트하고 있습니다...**")

    async def get_or_create_category(name, overwrites=None):
        for cat in guild.categories:
            if name.replace(" ", "") in cat.name.replace(" ", ""):
                return cat
        return await guild.create_category(name, overwrites=overwrites)

    async def get_or_create_text_channel(cat, name):
        for ch in cat.text_channels:
            if name.replace(" ", "") in ch.name.replace(" ", ""):
                return ch
        return await guild.create_text_channel(name, category=cat)

    async def get_or_create_voice_channel(cat, name):
        for ch in cat.voice_channels:
            if name.replace(" ", "") in ch.name.replace(" ", ""):
                return ch
        return await guild.create_voice_channel(name, category=cat)

    try:
        role_vice = discord.utils.get(guild.roles, name="부문주")

        # 문파원(everyone) 읽기 전용 (글 작성 불가, 보기만 가능)
        read_only_overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=True, send_messages=False),
            guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_messages=True)
        }
        if role_vice:
            read_only_overwrites[role_vice] = discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_messages=True)

        # 1. 📢 [ 문파 안내소 ]
        cat_info = await get_or_create_category("📢 [ 문파 안내소 ]")
        ch_notice = await get_or_create_text_channel(cat_info, "📌︱문파-공지사항")
        await ch_notice.edit(overwrites=read_only_overwrites)
        ch_rules = await get_or_create_text_channel(cat_info, "📜︱분배-규칙-안내")
        await ch_rules.edit(overwrites=read_only_overwrites)
        ch_sheet = await get_or_create_text_channel(cat_info, "📊︱실시간-분배시트")
        await ch_sheet.edit(overwrites=read_only_overwrites)

        # 2. ⚔️ [ 컨텐츠 참여 인증 ]
        cat_raid = await get_or_create_category("⚔️ [ 컨텐츠 참여 인증 ]")
        ch_cert = await get_or_create_text_channel(cat_raid, "📸︱참여-인증-스크린샷")
        await ch_cert.edit(overwrites=read_only_overwrites)
        ch_rank = await get_or_create_text_channel(cat_raid, "🏆︱참여-순위-현황")
        await ch_rank.edit(overwrites=read_only_overwrites)

        # 3. 💬 [ 문파 쉼터 ]
        cat_comm = await get_or_create_category("💬 [ 문파 쉼터 ]")
        await get_or_create_text_channel(cat_comm, "💬︱자유-수다방")
        await get_or_create_text_channel(cat_comm, "💬︱tts-수다방")
        await get_or_create_text_channel(cat_comm, "🎮︱공략-팁-공유")
        await get_or_create_text_channel(cat_comm, "❓︱질문-건의사항")

        # 4. 🔒 [ 문파 운영진 ]
        admin_overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_messages=True)
        }
        if role_vice:
            admin_overwrites[role_vice] = discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_messages=True)
        cat_admin = await get_or_create_category("🔒 [ 문파 운영진 ]", overwrites=admin_overwrites)
        ch_admin_bot = await get_or_create_text_channel(cat_admin, "🛠️︱문파장-봇-제어")
        await ch_admin_bot.edit(overwrites=admin_overwrites)

        # 5. 🔊 [ 보이스 채널 ]
        cat_voice = await get_or_create_category("🔊 [ 보이스 채널 ]")
        await get_or_create_voice_channel(cat_voice, "🔊︱도깨비 1파티")
        await get_or_create_voice_channel(cat_voice, "🔊︱도깨비 2파티")
        await get_or_create_voice_channel(cat_voice, "🔊︱레이드 공격대")
        await get_or_create_voice_channel(cat_voice, "☕︱도란도란 쉼터")

        # 안내 카드 전송
        await ch_rules.send(embed=get_rules_embed())
        await ch_sheet.send(embed=get_sheet_embed())
        await ch_cert.send(embed=get_cert_embed())
        await ch_admin_bot.send(embed=get_admin_embed())

        await status_msg.edit(
            content=f"🎉 **외길 문파 채널 및 안내 카드 업데이트 완료!**\n\n"
                    f"• 📜 **분배 규칙 안내**: {ch_rules.mention}\n"
                    f"• 📊 **구글 시트 링크**: {ch_sheet.mention}\n"
                    f"• 📸 **스크린샷 인증**: {ch_cert.mention}\n"
                    f"• 🛠️ **운영진 제어실**: {ch_admin_bot.mention}\n\n"
                    f"💡 중복 생성 없이 기존 채널에 최신 안내 카드가 게시되었습니다!"
        )

    except Exception as e:
        logger.error(f"채널 세팅 중 오류: {e}")
        await status_msg.edit(content=f"❌ 오류가 발생했습니다: {e}")

# ==========================================
# 기본 문파 관리 명령어
# ==========================================

@bot.command(name="현황", aliases=["목록", "참여현황"])
async def cmd_status(ctx):
    """현재 문파원들의 누적 참여 횟수를 조회합니다."""
    try:
        members = await sheet_mgr.get_all_members()
        if not members:
            await ctx.send("시트에 등록된 문파원이 없습니다.")
            return

        sorted_members = sorted(members.items(), key=lambda x: x[1].get("count", 0), reverse=True)

        embed = discord.Embed(
            title="📊 도깨비의 세계 [외길] 문파 주간 참여 현황",
            description=f"총 문파원: **{len(members)}명**",
            color=discord.Color.blue()
        )

        lines = []
        for rank, (name, info) in enumerate(sorted_members, start=1):
            cnt = info.get("count", 0)
            medal = "🥇 " if rank == 1 else "🥈 " if rank == 2 else "🥉 " if rank == 3 else f"{rank}. "
            lines.append(f"{medal}**{name}**: {cnt}회")

        # 전원 명단 분할 출력 (디스코드 1024자 제한 안전 보장 및 전원 표시)
        chunk_size = 20
        if len(lines) <= 25:
            embed.add_field(name="🏆 문파원 참여 순위 (전원)", value="\n".join(lines), inline=False)
        else:
            for i in range(0, len(lines), chunk_size):
                chunk_lines = lines[i:i + chunk_size]
                start_num = i + 1
                end_num = i + len(chunk_lines)
                embed.add_field(
                    name=f"🏆 문파원 참여 순위 ({start_num} ~ {end_num}위)",
                    value="\n".join(chunk_lines),
                    inline=False
                )

        embed.set_footer(text="구글 시트 체크박스 실시간 연동 • 용맹의 증표 분배 기준")
        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send(f"❌ 조회 중 오류: {e}")

@bot.command(name="문파원추가", aliases=["문파원등록", "신규등록", "신규문파원", "멤버추가"])
@commands.check(is_manager_or_admin)
async def cmd_add_member(ctx, *, name: str = None):
    """신규 문파원을 시트에 등록합니다."""
    if not name:
        embed = discord.Embed(
            title="⚠️ 문파원 닉네임을 입력해주세요!",
            description="추가할 문파원의 게임 닉네임을 함께 적어주세요.\n\n"
                        "💡 **사용법**: `!문파원추가 [닉네임]`\n"
                        "💡 **예시**: `!문파원추가 최강홍섭`",
            color=discord.Color.orange()
        )
        await ctx.send(embed=embed)
        return

    name = name.strip()
    status_msg = await ctx.send(f"⏳ **'{name}'** 문파원을 구글 시트에 등록하는 중입니다...")

    try:
        # 이미 등록된 문파원인지 확인
        members = await sheet_mgr.get_all_members()
        if name in members:
            embed_exist = discord.Embed(
                title="⚠️ 이미 등록된 문파원입니다",
                description=f"**'{name}'** 님은 이미 구글 시트({members[name].get('row')}행)에 등록되어 있습니다.\n"
                            f"추가 등록 없이 바로 스크린샷 인증을 진행하시면 됩니다.",
                color=discord.Color.gold()
            )
            await status_msg.edit(content=None, embed=embed_exist)
            return

        success = await sheet_mgr.add_new_member(name)
        if success:
            await sync_to_website({"action": "ADD_MEMBER", "nickname": name})
            embed_success = discord.Embed(
                title="🎉 신규 문파원 등록 완료!",
                description=f"**'{name}'** 님이 구글 시트 및 공식 웹사이트 출석부에 정상적으로 추가되었습니다.\n"
                            f"이제 컨텐츠 스크린샷을 올리시면 자동으로 닉네임이 인식되어 체크(☑)됩니다.",
                color=discord.Color.green()
            )
            embed_success.add_field(name="📊 실시간 분배 시트", value=f"[구글 스프레드시트 바로가기]({SHEET_PUBLIC_URL})", inline=False)
            await status_msg.edit(content=None, embed=embed_success)
        else:
            await status_msg.edit(content=f"❌ **'{name}'** 문파원 등록에 실패했습니다. 시트 상태를 확인해주세요.")
    except Exception as e:
        logger.error(f"문파원 추가 오류: {e}")
        await status_msg.edit(content=f"❌ 등록 중 오류가 발생했습니다: {e}")

@bot.command(name="문파원삭제", aliases=["문파원추방", "멤버삭제", "멤버추방", "문파원탈퇴", "추방"])
@commands.check(is_manager_or_admin)
async def cmd_delete_member(ctx, *, name: str = None):
    """탈퇴 또는 추방된 문파원을 시트에서 삭제(행 삭제)합니다."""
    if not name:
        embed = discord.Embed(
            title="⚠️ 문파원 닉네임을 입력해주세요!",
            description="삭제할 문파원의 게임 닉네임을 함께 적어주세요.\n\n"
                        "💡 **사용법**: `!문파원삭제 [닉네임]`\n"
                        "💡 **예시**: `!문파원삭제 홍길동`",
            color=discord.Color.orange()
        )
        await ctx.send(embed=embed)
        return

    name = name.strip()
    status_msg = await ctx.send(f"⏳ **'{name}'** 문파원을 구글 시트에서 확인 후 삭제하는 중입니다...")

    try:
        members = await sheet_mgr.get_all_members()
        member_names = list(members.keys())

        target_name = None
        if name in members:
            target_name = name
        else:
            match = process.extractOne(name, member_names, scorer=fuzz.ratio, score_cutoff=85)
            if match:
                target_name = match[0]

        if not target_name:
            embed_not_found = discord.Embed(
                title="⚠️ 시트에 등록되지 않은 문파원입니다",
                description=f"**'{name}'** 님을 구글 시트 명단에서 찾을 수 없습니다.\n\n"
                            f"💡 현재 등록된 문파원 명단은 `!현황` 명령어로 확인하실 수 있습니다.",
                color=discord.Color.red()
            )
            await status_msg.edit(content=None, embed=embed_not_found)
            return

        success, msg = await sheet_mgr.delete_member(target_name)
        if success:
            await sync_to_website({"action": "DELETE_MEMBER", "nickname": target_name})
            embed_success = discord.Embed(
                title="🗑️ 문파원 삭제 완료",
                description=f"**'{target_name}'** 문파원의 행이 구글 시트 및 웹사이트 출석부에서 성공적으로 삭제되었습니다.\n\n"
                            f"• 봇의 자동 감지 명단 및 참여 통계에서 즉시 제외되었습니다.\n"
                            f"• 번호(No.) 및 등록 문파원 수가 자동으로 재정렬되었습니다.",
                color=discord.Color.green()
            )
            embed_success.add_field(name="📊 실시간 분배 시트", value=f"[구글 스프레드시트 바로가기]({SHEET_PUBLIC_URL})", inline=False)
            await status_msg.edit(content=None, embed=embed_success)
        else:
            await status_msg.edit(content=f"❌ **'{target_name}'** 문파원 삭제 실패: {msg}")
    except Exception as e:
        logger.error(f"문파원 삭제 오류: {e}")
        await status_msg.edit(content=f"❌ 삭제 중 오류가 발생했습니다: {e}")

MANUAL_CONTENT_KEYWORDS = {
    "1": "요신 토벌령",
    "요신": "요신 토벌령",
    "토벌": "요신 토벌령",
    "토벌령": "요신 토벌령",
    "2": "결계지 방어",
    "결계": "결계지 방어",
    "결계지": "결계지 방어",
    "방어": "결계지 방어",
    "3": "미혹의 정원",
    "미혹": "미혹의 정원",
    "정원": "미혹의 정원",
    "4": "신기 쟁탈전",
    "신기": "신기 쟁탈전",
    "쟁탈": "신기 쟁탈전",
    "쟁탈전": "신기 쟁탈전",
}

@bot.command(name="수동추가", aliases=["참여추가", "체크", "수동체크"])
@commands.check(is_manager_or_admin)
async def cmd_manual_add(ctx, name: str = None, *, content: str = None):
    """[문파장/운영진] 스크린샷 미인식 또는 누락 시 특정 문파원의 컨텐츠 체크박스를 수동으로 체크합니다."""
    if not name:
        embed = discord.Embed(
            title="⚠️ 문파원 닉네임과 컨텐츠명을 입력해주세요!",
            description="스크린샷에서 누락된 문파원의 **닉네임**과 참여한 **컨텐츠 이름**을 적어주세요.\n\n"
                        "💡 **사용법**: `!수동추가 [닉네임] [컨텐츠]`\n"
                        "💡 **예시**: `!수동추가 홍길동 요신` 또는 `!수동추가 최강홍섭 신기`\n\n"
                        "**[컨텐츠 키워드]**\n"
                        "• `요신` : 요신 토벌령\n"
                        "• `결계` : 결계지 방어\n"
                        "• `미혹` : 미혹의 정원\n"
                        "• `신기` : 신기 쟁탈전",
            color=discord.Color.orange()
        )
        await ctx.send(embed=embed)
        return

    # 순서를 반대로 입력한 경우 (예: !수동추가 신기 홍길동) 자동 감지 및 맞바꿈
    if name in ["요신", "토벌", "결계", "방어", "미혹", "정원", "신기", "쟁탈", "1", "2", "3", "4"] and content:
        name, content = content, name

    # 컨텐츠 매핑 (스크린샷 인증과 동일한 키워드: 요신, 결계, 미혹, 신기)
    detected_content = ""
    if content:
        content_clean = content.strip().lower()
        for kw, full_name in MANUAL_CONTENT_KEYWORDS.items():
            if kw in content_clean:
                detected_content = full_name
                break

    if not detected_content:
        embed = discord.Embed(
            title="⚠️ 참여 컨텐츠를 지정해주세요!",
            description=f"**'{name}'** 님이 참여한 컨텐츠를 함께 적어주세요.\n"
                        "우리 외길 문파는 4대 컨텐츠별 체크박스(☑)로 운영됩니다.\n\n"
                        "**[컨텐츠 키워드]**\n"
                        "• `요신` : 요신 토벌령\n"
                        "• `결계` : 결계지 방어\n"
                        "• `미혹` : 미혹의 정원\n"
                        "• `신기` : 신기 쟁탈전\n\n"
                        f"💡 **예시**: `!수동추가 {name} 요신` 또는 `!수동추가 {name} 신기`",
            color=discord.Color.orange()
        )
        await ctx.send(embed=embed)
        return

    name = name.strip()
    status_msg = await ctx.send(f"⏳ **'{name}'** 님의 **[{detected_content}]** 참여를 구글 시트에 반영 중입니다...")

    try:
        members = await sheet_mgr.get_all_members()
        member_names = list(members.keys())

        # 닉네임 정확 매칭 or 퍼지 매칭
        target_name = None
        if name in members:
            target_name = name
        else:
            match = process.extractOne(name, member_names, scorer=fuzz.ratio, score_cutoff=80)
            if match:
                target_name = match[0]

        if not target_name:
            embed_not_found = discord.Embed(
                title="⚠️ 시트에 등록되지 않은 문파원입니다",
                description=f"**'{name}'** 님을 구글 시트 명단에서 찾을 수 없습니다.\n\n"
                            f"💡 신규 문파원이라면 먼저 `!문파원추가 {name}`으로 등록한 후 다시 시도해주세요.",
                color=discord.Color.red()
            )
            await status_msg.edit(content=None, embed=embed_not_found)
            return

        # 분신 여부 판별
        is_clone = any(k in (content or "") for k in ["분신", "분신등록", "자동"])
        part_type = "CLONE" if is_clone else "MANUAL"
        part_badge = "👤 분신 등록 (+0.25P)" if is_clone else "⚔️ 직접 수동 참가 (+1.0P)"

        updated, unknown = await sheet_mgr.add_participation([target_name], detected_content)

        # 웹사이트 API로 출석 & 포인트(수동 1.0P / 분신 0.25P) 실시간 동기화
        await sync_to_website({"nickname": target_name, "content": detected_content, "type": part_type})

        if updated:
            embed_success = discord.Embed(
                title=f"✅ 수동 참여 체크 완료 ({detected_content})",
                description=f"**{target_name}** 님의 **{detected_content}** 체크가 완료되었습니다!\n\n"
                            f"• 반영 결과: **{updated[0]}**\n"
                            f"• 참여 형태: **{part_badge}**",
                color=discord.Color.green()
            )
            embed_success.add_field(name="📊 실시간 분배 시트", value=f"[구글 스프레드시트 바로가기]({SHEET_PUBLIC_URL})", inline=True)
            embed_success.add_field(name="🌐 외길 문파 웹사이트", value=f"[웹사이트 바로가기]({config.WEB_SITE_URL})", inline=True)
            embed_success.set_footer(text="구글 시트 및 웹사이트에 실시간 반영되어 총 포인트 및 예상 분배금이 자동 갱신되었습니다.")
            await status_msg.edit(content=None, embed=embed_success)
        else:
            await status_msg.edit(content=f"❌ **'{target_name}'** 님의 시트 반영에 실패했습니다. 시트 상태를 확인해주세요.")

    except Exception as e:
        logger.error(f"수동 추가 오류: {e}")
        await status_msg.edit(content=f"❌ 처리 중 오류가 발생했습니다: {e}")

@bot.command(name="초기화", aliases=["리셋"])
@commands.check(is_manager_or_admin)
async def cmd_reset(ctx):
    """[문파장/부문주/간부 전용] 모든 문파원의 체크박스를 해제하여 0으로 리셋합니다."""
    confirm_msg = await ctx.send("⚠️ **경고**: 이번 주차 정산이 끝나고 모든 체크박스를 0으로 초기화하시겠습니까? (15초 내에 '네' 입력)")

    def check(m):
        return m.author == ctx.author and m.channel == ctx.channel and m.content.strip() == "네"

    try:
        await bot.wait_for("message", timeout=15.0, check=check)
        reset_cnt = await sheet_mgr.reset_all_counts()
        await sync_to_website({"action": "RESET_ALL"})
        await ctx.send(f"🔄 총 {reset_cnt}명의 문파원 참여 체크박스 및 웹사이트 출석부가 초기화되었습니다! 다음 주차 정산을 시작하세요.")
    except TimeoutError:
        await ctx.send("⏱️ 시간이 초과되어 초기화가 취소되었습니다.")
    except Exception as e:
        await ctx.send(f"❌ 초기화 오류: {e}")

@cmd_reset.error
async def cmd_reset_error(ctx, error):
    if isinstance(error, commands.CheckFailure):
        await ctx.send("⛔ **권한 부족**: 이 명령어는 **문파장, 부문주, 또는 지정된 간부**만 사용할 수 있습니다.")

@bot.command(name="사이트", aliases=["웹사이트", "홈페이지", "경매장", "상점", "포털", "분배"])
async def cmd_website(ctx):
    """외길 문파 공식 웹사이트 링크와 원스톱 시스템(참여율, 상점, 경매, 분배) 안내"""
    embed = discord.Embed(
        title="🌐 외길 문파 공식 통합 포털",
        description="문파 컨텐츠 참여율 확인부터 문파 상점 아이템 구매, 최소 입찰가를 직접 설정한 경매 진행 및 참여도 비례 금전 분배까지 원스톱으로 제공합니다!",
        color=discord.Color.gold(),
        url=config.WEB_SITE_URL
    )
    embed.add_field(name="🔗 공식 포털 바로가기", value=f"[👉 외길 문파 웹사이트 열기]({config.WEB_SITE_URL})", inline=False)
    embed.add_field(
        name="✨ 4대 원스톱 시스템 흐름",
        value="1️⃣ **컨텐츠 참여율**: 수동(1.0P) / 분신(0.25P) 실시간 자동 집계\n"
              "2️⃣ **문파 상점**: 문파 재화 및 금전으로 상점 아이템 구매\n"
              "3️⃣ **최소 입찰가 경매**: 최소 시작가 & 호가 단위를 직접 설정하여 실시간 입찰\n"
              "4️⃣ **공정 금전 분배**: 최종 낙찰금(예: 3만 금전)을 참여 포인트 비율대로 100% 자동 분배",
        inline=False
    )
    embed.set_footer(text="※ 보안을 위해 회원가입 후 문파장 승인을 받은 정회원만 로그인하여 열람할 수 있습니다.")
    await ctx.send(embed=embed)

@bot.command(name="도움말", aliases=["명령어"])
async def cmd_help(ctx):
    """봇 사용법 및 명령어 안내"""
    embed = discord.Embed(
        title="📖 도깨비의 세계 [외길] 문파 분배 도우미 봇 안내",
        description="4대 컨텐츠 스크린샷을 올리면 닉네임을 감지해 구글 시트 및 웹사이트에 포인트를 자동으로 체크합니다.",
        color=discord.Color.gold()
    )
    embed.add_field(name="🌐 !사이트", value="외길 문파 공식 웹사이트 (출석부, 경매장, 상점) 링크 확인", inline=False)
    embed.add_field(name="🔄 !채널업데이트", value="새 채널을 만들지 않고, 이미 만들어진 채널의 안내 카드만 최신화합니다.", inline=False)
    embed.add_field(name="➕ !문파원추가 [닉네임]", value="새로운 문파원을 구글 시트에 신규 등록합니다.", inline=False)
    embed.add_field(name="🗑️ !문파원삭제 [닉네임]", value="탈퇴/추방된 문파원을 구글 시트에서 행 삭제합니다.", inline=False)
    embed.add_field(name="✏️ !수동추가 [닉네임] [컨텐츠] (분신)", value="수동 체크 (예: `!수동추가 홍길동 요신` -> 1P / `!수동추가 홍길동 요신 분신` -> 0.25P)", inline=False)
    embed.add_field(name="📸 스크린샷 자동 집계", value="스크린샷과 함께 컨텐츠명(요신/결계/미혹/신기)을 적어 올리면 자동 체크됩니다. (분신일 경우 '분신' 단어 포함 시 0.25P)", inline=False)
    embed.add_field(name="!현황", value="현재 문파원들의 주간 참여 순위를 확인합니다.", inline=False)
    embed.add_field(name="!초기화", value="[관리자 전용] 주간 분배 정산 종료 후 모든 체크박스를 리셋합니다.", inline=False)
    await ctx.send(embed=embed)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    elif isinstance(error, commands.CheckFailure):
        await ctx.send("⛔ **권한 부족**: 해당 명령어를 실행할 권한이 없습니다.")
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.send(f"⚠️ 필수 입력 항목이 누락되었습니다. (`{ctx.prefix}{ctx.command.name} {ctx.command.signature}`)")
    else:
        logger.error(f"명령어 처리 중 오류: {error}")
        await ctx.send(f"❌ 명령어 실행 중 오류가 발생했습니다: {error}")

if __name__ == "__main__":
    if not config.DISCORD_BOT_TOKEN:
        print("[!] 오류: .env 파일에 DISCORD_BOT_TOKEN 이 비어 있습니다.")
    else:
        bot.run(config.DISCORD_BOT_TOKEN)
