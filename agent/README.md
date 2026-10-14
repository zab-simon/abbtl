# Claude-агент для issue

Агент живёт в GitHub Actions и отвечает в issue с помощью Claude.

## Настройка (один раз)

1. Получите API-ключ на https://platform.claude.com → API Keys.
2. В репозитории: **Settings → Secrets and variables → Actions → New repository secret**,
   имя `ANTHROPIC_API_KEY`, значение — ваш ключ.
3. Влейте эту ветку в `main`: GitHub запускает workflow для issue только из ветки по умолчанию.

## Как пользоваться

- Создайте issue и напишите в тексте `/agent`, или повесьте на issue метку `agent`.
- Чтобы продолжить разговор, оставьте комментарий с `/agent`.

Вызвать агента могут только владелец и участники репозитория.
Модель можно сменить переменной `AGENT_MODEL` в `.github/workflows/agent.yml`,
а характер агента — в `SYSTEM_PROMPT` в `agent/agent.py`.
