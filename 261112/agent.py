"""Простой GitHub-агент: отвечает в issue с помощью Claude.

Запускается из .github/workflows/agent.yml. Собирает переписку в issue,
отправляет её Claude и публикует ответ комментарием.
"""

import json
import os
import urllib.request

import anthropic

MODEL = os.environ.get("AGENT_MODEL", "claude-opus-5-5")
TRIGGER = "/agent"
FOOTER = "\n\n---\n_🤖 Ответ сгенерирован агентом на Claude_"

SYSTEM_PROMPT = """Ты — дружелюбный помощник репозитория на GitHub.
Отвечай на вопросы пользователей в issue: кратко, по делу, на языке вопроса.
Используй Markdown. Если не знаешь ответа — честно скажи об этом."""


def github(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Accept": "application/vnd.github+json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def build_messages(issue, comments):
    """Превращает issue и комментарии в диалог user/assistant."""
    messages = []

    def add(role, text):
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += "\n\n" + text
        else:
            messages.append({"role": role, "content": text})

    add("user", f"# {issue['title']}\n\n{issue.get('body') or ''}")
    for c in comments:
        body = c.get("body") or ""
        if body.endswith(FOOTER):
            add("assistant", body[: -len(FOOTER)])
        else:
            add("user", f"{c['user']['login']}: {body}")
    return messages


def main():
    with open(os.environ["GITHUB_EVENT_PATH"]) as f:
        event = json.load(f)
    issue = event["issue"]
    number = issue["number"]

    comments = github("GET", f"/issues/{number}/comments?per_page=100")
    messages = build_messages(issue, comments)

    client = anthropic.Anthropic()
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "medium"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    if response.stop_reason == "refusal":
        answer = "Извините, я не могу ответить на этот запрос."
    else:
        answer = "".join(b.text for b in response.content if b.type == "text").strip()

    github("POST", f"/issues/{number}/comments", {"body": answer + FOOTER})
    print(f"Ответ опубликован в issue #{number}")


if __name__ == "__main__":
    main()
