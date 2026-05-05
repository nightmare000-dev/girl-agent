# Changelog

## 0.1.2 — communication realism update

Дата: 2026-05-05

- Hotfix: профили из wizard теперь сохраняются раньше, а список профилей больше не показывает недосохранённые папки без `config.json`.
- Добавлены жизненные стили общения: **Нормальная**, **Милая**, **Альтушка**, **Залипала**, **Болтушка**.
- Добавлен `CommunicationProfile` с настройками уведомлений, стиля сообщений, инициативы и life sharing.
- Presence, reply timing, bubbles, ignore chance и proactive agenda теперь учитывают профиль общения.
- Wizard и CLI получили настройку communication profile.
- Runtime `:status` и `:debug` показывают профиль общения.
- Команда `:log` стала удобнее и поддерживает выбор дня/лимита вывода.
- Старый `vibe` автоматически нормализуется в новый формат.

## 0.1.1 — stability baseline

- Базовый публичный релиз с Telegram bot/userbot режимами.
- Persona, speech, relationship state, memory, conflict и agenda-модули.
- Документация по установке, конфигурации, реализм-модулям и troubleshooting.
