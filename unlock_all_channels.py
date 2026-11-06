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
        print(f"\n[🔓] '{guild.name}' 서버의 모든 채널을 완전 개방(모두가 보고 쓰고 삭제 가능)합니다...")

        # 1. 모든 카테고리 잠금 해제
        for cat in guild.categories:
            print(f"[*] 카테고리 개방: {cat.name}")
            try:
                await cat.set_permissions(
                    guild.default_role,
                    view_channel=True,
                    send_messages=True,
                    manage_messages=True,
                    attach_files=True,
                    embed_links=True,
                    connect=True,
                    speak=True
                )
            except Exception as e:
                print(f"[-] 카테고리 권한 설정 실패: {e}")

        # 2. 모든 텍스트 채널 개방
        for ch in guild.text_channels:
            print(f"[*] 텍스트 채널 개방: {ch.name}")
            try:
                await ch.set_permissions(
                    guild.default_role,
                    view_channel=True,
                    send_messages=True,
                    manage_messages=True,
                    attach_files=True,
                    embed_links=True,
                    read_message_history=True
                )
            except Exception as e:
                print(f"[-] 채널 권한 설정 실패: {e}")

        # 3. 모든 음성 채널 개방
        for vc in guild.voice_channels:
            print(f"[*] 음성 채널 개방: {vc.name}")
            try:
                await vc.set_permissions(
                    guild.default_role,
                    view_channel=True,
                    connect=True,
                    speak=True
                )
            except Exception as e:
                print(f"[-] 음성 채널 권한 설정 실패: {e}")

        print("\n✨ 모든 채널이 모두에게 자유롭게 열렸습니다! (보기, 작성, 수정, 삭제 100% 가능)")

    await client.close()

if __name__ == "__main__":
    client.run(TOKEN)
