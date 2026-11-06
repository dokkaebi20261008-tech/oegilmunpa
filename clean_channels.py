import os
import sys
import asyncio
import discord
from dotenv import load_dotenv

if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")

intents = discord.Intents.default()
intents.guilds = True

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"로그인 성공: {client.user.name}")
    for guild in client.guilds:
        print(f"\n[🚀] '{guild.name}' 서버의 중복 채널 자동 청소를 시작합니다...")

        # 1. 중복 카테고리 감지 및 삭제
        seen_categories = {}
        for cat in list(guild.categories):
            name = cat.name.strip()
            if name in seen_categories:
                print(f"[-] 중복 카테고리 삭제: {name}")
                for ch in list(cat.channels):
                    print(f"    └ 하위 채널 삭제: {ch.name}")
                    try:
                        await ch.delete()
                    except Exception as e:
                        print(f"    └ 삭제 실패: {e}")
                try:
                    await cat.delete()
                except Exception as e:
                    print(f"[-] 카테고리 삭제 실패: {e}")
            else:
                seen_categories[name] = cat

        # 2. 개별 중복 텍스트/보이스 채널 감지 및 삭제 (카테고리 무관 동일 이름 채널)
        seen_channels = {}
        for ch in list(guild.channels):
            if isinstance(ch, discord.CategoryChannel):
                continue
            name = ch.name.strip()
            if name in seen_channels:
                print(f"[-] 중복 채널 삭제: {name}")
                try:
                    await ch.delete()
                except Exception as e:
                    print(f"[-] 채널 삭제 실패: {e}")
            else:
                seen_channels[name] = ch

        print("\n✨ 중복 채널 자동 정리 완료! 서버가 깨끗해졌습니다.")

    await client.close()

if __name__ == "__main__":
    client.run(TOKEN)
