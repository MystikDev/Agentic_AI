"""Interactive advisor REPL bridging Anthropic Messages API and the financial MCP server."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from contextlib import AsyncExitStack

from anthropic import Anthropic
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from .system_prompt import SYSTEM_PROMPT

load_dotenv()

MODEL = os.getenv("ADVISOR_MODEL", "claude-opus-4-7")
MAX_TOKENS = 4096
MAX_AGENT_TURNS = 12


class Advisor:
    def __init__(self) -> None:
        self.anthropic = Anthropic()
        self.session: ClientSession | None = None
        self.tools: list[dict] = []
        self.history: list[dict] = []
        self._stack = AsyncExitStack()

    async def connect(self) -> None:
        params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "mcp_server"],
            env=os.environ.copy(),
        )
        stdio = await self._stack.enter_async_context(stdio_client(params))
        read, write = stdio
        self.session = await self._stack.enter_async_context(ClientSession(read, write))
        await self.session.initialize()

        listed = await self.session.list_tools()
        self.tools = [
            {
                "name": t.name,
                "description": t.description or "",
                "input_schema": t.inputSchema,
            }
            for t in listed.tools
        ]

    async def close(self) -> None:
        await self._stack.aclose()

    async def _call_tool(self, name: str, args: dict) -> str:
        assert self.session is not None
        result = await self.session.call_tool(name, args)
        parts: list[str] = []
        for c in result.content:
            if getattr(c, "type", None) == "text":
                parts.append(c.text)
            else:
                parts.append(str(c))
        return "\n".join(parts) or "(no content)"

    async def ask(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})
        final_text: list[str] = []

        for _ in range(MAX_AGENT_TURNS):
            resp = self.anthropic.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                tools=self.tools,
                messages=self.history,
            )

            assistant_content = resp.content
            self.history.append({"role": "assistant", "content": assistant_content})

            tool_uses = [b for b in assistant_content if b.type == "tool_use"]
            for block in assistant_content:
                if block.type == "text" and block.text.strip():
                    final_text.append(block.text)

            if resp.stop_reason != "tool_use" or not tool_uses:
                break

            tool_results = []
            for tu in tool_uses:
                try:
                    out = await self._call_tool(tu.name, tu.input or {})
                except Exception as e:
                    out = json.dumps({"error": str(e)})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": out,
                })
            self.history.append({"role": "user", "content": tool_results})

        return "\n".join(final_text).strip() or "(no response)"


BANNER = """\
Personal Financial Advisor
Type a question. Commands: :reset  :tools  :history  :quit
"""


async def repl() -> None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY is not set. Put it in .env or export it.", file=sys.stderr)
        sys.exit(1)

    advisor = Advisor()
    try:
        await advisor.connect()
    except Exception as e:
        print(f"Failed to start MCP server: {e}", file=sys.stderr)
        sys.exit(1)

    print(BANNER)
    print(f"Loaded {len(advisor.tools)} tools from the financial MCP server.\n")

    try:
        while True:
            try:
                line = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if not line:
                continue
            if line in (":quit", ":q", ":exit"):
                break
            if line == ":reset":
                advisor.history = []
                print("(history cleared)")
                continue
            if line == ":tools":
                for t in advisor.tools:
                    print(f"  {t['name']}: {t['description'].splitlines()[0] if t['description'] else ''}")
                continue
            if line == ":history":
                print(json.dumps(advisor.history, indent=2, default=str)[:4000])
                continue
            try:
                out = await advisor.ask(line)
            except Exception as e:
                print(f"error: {e}")
                continue
            print(f"\n{out}\n")
    finally:
        await advisor.close()


def main() -> None:
    asyncio.run(repl())


if __name__ == "__main__":
    main()
