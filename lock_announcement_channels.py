import os
import sys
import asyncio
import discord
from dotenv import load_dotenv

if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")

intents = discord.Intents.default()
intents.guilds = True

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"로그인 성공: {client.user.name}")
    for guild in client.guilds:
        print(f"\n[🔒] '{guild.name}' 서버의 안내소 채널 읽기 전용 권한 설정을 시작합니다...")

        # 1. '부문주' 역할 탐색 (없으면 자동 생성)
        bumunju_role = None
        for role in guild.roles:
            if "부문주" in role.name:
                bumunju_role = role
                break

        if not bumunju_role:
            print("[+] '부문주' 역할을 생성합니다...")
            bumunju_role = await guild.create_role(name="부문주", color=discord.Color.blue(), mentionable=True)
            print(f"[+] '부문주' 역할 생성 완료 (ID: {bumunju_role.id})")
        else:
            print(f"[✓] 기존 '부문주' 역할 확인 (ID: {bumunju_role.id})")

        # 2. 대상 안내 채널들 탐색
        target_keywords = ["공지사항", "분배-규칙", "분배시트"]
        
        for ch in guild.text_channels:
            if any(kw in ch.name for kw in target_keywords):
                print(f"[*] 채널 권한 설정 중: {ch.name}")
                
                # @everyone: 보기만 가능, 글 작성 금지
                await ch.set_permissions(
                    guild.default_role,
                    view_channel=True,
                    send_messages=False,
                    add_reactions=True,
                    create_public_threads=False,
                    create_private_threads=False
                )

                # 부문주: 글 작성 및 글 삭제/관리 가능!
                await ch.set_permissions(
                    bumunju_role,
                    view_channel=True,
                    send_messages=True,
                    manage_messages=True,
                    embed_links=True,
                    attach_files=True
                )

                # 봇(도깨비도우미): 글 작성 가능
                await ch.set_permissions(
                    guild.me,
                    view_channel=True,
                    send_messages=True,
                    manage_messages=True,
                    embed_links=True,
                    attach_files=True
                )

                print(f"    └ {ch.name} 권한 설정 완료 (일반인: 읽기 전용 / 문파장·부문주: 작성 및 삭제 가능)")

        print("\n🎉 모든 안내 채널 권한 설정이 완료되었습니다!")

    await client.close()

if __name__ == "__main__":
    client.run(TOKEN)
