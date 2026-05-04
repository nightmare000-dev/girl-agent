import type { LLMClient } from "../llm/index.js";
import type { BehaviorTickResult, ProfileConfig } from "../types.js";
import { findStage } from "../presets/stages.js";
import { readRelationship } from "../storage/md.js";
import type { PresenceState } from "./presence.js";
import type { ConflictState } from "./conflict.js";

const SYS = `Ты — внутренний "decision layer" для симуляции живой девушки. По текущему состоянию реши, как она отреагирует на новое сообщение от парня. Никаких разговоров — только JSON.`;

interface BehaviorContext {
  presence?: PresenceState;
  conflict?: ConflictState;
  conflictColdActive?: boolean;
  blockHint?: string; // что она сейчас делает по daily-life
  activeDialog?: boolean;
}

function reactionMenu(stage: string, score: { attraction: number; interest: number; annoyance: number; cringe: number }): string {
  const isWarm = score.attraction > 30 || ["dating-early", "dating-stable", "long-term"].includes(stage);
  const isCold = score.annoyance > 40 || stage === "tg-given-cold";

  if (isWarm) {
    return `Доступные реакции (СТАДИЯ ТЁПЛАЯ — она расположена к нему):
- ❤ / 🥰 / 🥹 — на милое/трогательное
- 😂 / 🤭 — на смешное
- 🔥 — на крутое
- 👀 — на интригующее
- 🥺 — когда хочется внимания
- 😅 — когда лажа но милая
ЗАПРЕЩЕНО ставить: 🤡, 💀, 🤮, 🖕, 😐, 🙄 — влюблённая/расположенная девушка не пошлёт такое любимому. На неудачную шутку она просто мило не искренне посмеётся в тексте ("ахах ну такое") или поставит ❤/😂.`;
  }
  if (isCold) {
    return `Доступные реакции (СТАДИЯ ХОЛОДНАЯ/конфликт — она дистанцируется):
- 👍 / 👌 — отстранённое подтверждение
- 😐 / 🙄 — раздражение
- 🤡 — на кринж от него
- 💀 — на полный треш от него
- 🤔 — недоумение
ЗАПРЕЩЕНО ставить: ❤, 🥰, 🥹, 🥺, 🔥 — это сигналы тепла, она его сейчас не даёт.`;
  }
  // нейтральная середина
  return `Доступные реакции (нейтральная стадия):
- 👍 / 👌 — ок, принято
- 😂 / 🤭 — на смешное
- 🤔 — задумалась
- 🔥 — если реально круто
- 🤡 — только на явный кринж и без злобы
- 😐 — устала
Не ставь ❤/🥰 пока стадия не warming или выше — это палево, рано ещё.`;
}

const TEMPLATE = (state: string, history: string, incoming: string, ctx: BehaviorContext, reactionsHint: string) => `Состояние:
${state}
${ctx.presence ? `\nПрисутствие: ${ctx.presence.online ? "онлайн" : "офлайн"}${ctx.presence.asleep ? ", СПИТ" : ""}${ctx.presence.nightAwake ? ", НОЧНОЕ ПРОБУЖДЕНИЕ (заспанная, коротко)" : ""} (локально ${ctx.presence.localHour}:00). ${ctx.presence.hint}` : ""}
${ctx.blockHint ? `\nЧто сейчас делает: ${ctx.blockHint}` : ""}
${ctx.activeDialog ? `\nАКТИВНЫЙ ДИАЛОГ: она уже недавно ответила, а он написал в течение нескольких минут. Продолжай переписку, не уходи в случайный игнор без веской причины.` : ""}
${ctx.conflict && ctx.conflict.level > 0 ? `\nКонфликт: level ${ctx.conflict.level}, ${ctx.conflictColdActive ? "АКТИВНЫЙ cold-период (молчит/игнорит)" : "после-конфликтный осадок"}, причина: ${ctx.conflict.reason ?? "—"}` : ""}

Последние сообщения (последнее — от него):
${history}

НОВОЕ сообщение от него:
"""${incoming}"""

${reactionsHint}

Реши и верни СТРОГО JSON:
{
  "intent": "reply" | "ignore" | "short" | "left-on-read" | "leave-chat" | "reaction-only",
  "shouldReply": boolean,
  "shouldRead": boolean (даже если не отвечает, прочитать и поставить галочки? left-on-read=false, ignore=true если она зашла и прочитала),
  "delaySec": число (0..3600 секунд. Если она офлайн/занята/конфликт — большие задержки нормальны. Если активный диалог — маленькие.),
  "bubbles": число (1..6),
  "typing": boolean,
  "reaction": "" или ОДИН эмодзи из доступного списка выше. Не из запрещённого!,
  "ignoreReason": строка или "",
  "moodDelta": { "interest": число, "trust": число, "attraction": число, "annoyance": число, "cringe": число }
}

Правила:
- Если cold-period конфликта АКТИВЕН — почти всегда ignore или сухой short ответ. Ни ❤, ни ")".
- Если она СПИТ — ignore или left-on-read (shouldRead=false). Если энергично написал ночью — может разозлить (annoyance +).
- Если она занята по presence — не отвечай сразу; если сообщение в целом заслуживает ответа, ставь shouldReply=true и большой delaySec, runtime дотянет его до времени когда она освободится и проверит Telegram.
- Если она офлайн (не спит) — допустимо высокое delaySec (300-2400с) И normal reply, либо ignore с shouldRead=true (она зашла, прочитала, но ответит позже).
- Если стадия "tg-given-cold" и сообщение скучное/невнятное — высокая вероятность ignore или left-on-read.
- Если в сообщении кринж/токсик/нарушение boundaries — annoyance растёт, может быть ignore или leave-chat.
- Если милое/уместное на тёплой стадии — interest и attraction +.
- Длинная простыня от него — bubbles её ответа НЕ становится больше; скорее наоборот.
- moodDelta: маленькие числа -10..+10.
- Реакции — реальные девушки 2026 чаще ставят TG-реакцию чем эмодзи в текст. Если сообщение цепануло, а отвечать не хочется — "intent":"reaction-only", "shouldReply":false, "reaction":"...". По умолчанию reaction="".
- ВАЖНО: реакция должна соответствовать её отношению. Влюблённая НЕ ставит 🤡 на мем — она поставит 😂/❤ или мило посмеётся текстом. Холодная НЕ ставит ❤.
- НЕ оборачивай в markdown. Только JSON.`;

export async function behaviorTick(
  llm: LLMClient,
  cfg: ProfileConfig,
  recentHistory: { role: "user" | "assistant"; content: string }[],
  incoming: string,
  ctx: BehaviorContext = {}
): Promise<BehaviorTickResult> {
  const stage = findStage(cfg.stage);
  const rel = await readRelationship(cfg.slug);
  const state = `stage=${cfg.stage} (${stage.label})\nscore=${JSON.stringify(rel.score)}\nbase_ignore=${stage.defaults.ignoreChance}\nbase_delay=${stage.defaults.replyDelaySec.join("..")}s`;
  const reactionsHint = reactionMenu(cfg.stage, rel.score);

  const history = recentHistory.slice(-8)
    .map(m => `${m.role === "user" ? "он" : "она"}: ${m.content}`).join("\n");

  if (ctx.activeDialog && !ctx.conflictColdActive) {
    return {
      shouldReply: true,
      shouldRead: true,
      delaySec: clamp(cfg.vibe === "warm" ? 5 + Math.random() * 25 : 15 + Math.random() * 75, 3, 120),
      bubbles: cfg.vibe === "warm" ? 2 : 1,
      typing: true,
      ignoreReason: undefined,
      moodDelta: { interest: 1 },
      intent: cfg.vibe === "warm" ? "reply" : "short"
    };
  }

  // базовая защита: если cold-период активный — обходим LLM, сразу ignore с шансом 80%
  if (ctx.conflictColdActive && Math.random() < 0.8) {
    return {
      shouldReply: false,
      shouldRead: false,
      delaySec: 0,
      bubbles: 1,
      typing: false,
      ignoreReason: "conflict-cold",
      moodDelta: {},
      intent: "ignore"
    };
  }

  // warm vibe — снижает шанс случайного игнора
  const vibeIgnoreMul = cfg.vibe === "warm" ? 0.4 : 1.0;

  // если СПИТ — игнор почти всегда
  if (ctx.presence?.asleep && !ctx.presence.nightAwake && Math.random() < 0.85 * vibeIgnoreMul) {
    return {
      shouldReply: false,
      shouldRead: false,
      delaySec: 0,
      bubbles: 1,
      typing: false,
      ignoreReason: "asleep",
      moodDelta: {},
      intent: "left-on-read"
    };
  }

  // НОЧНОЕ ПРОБУЖДЕНИЕ: медленно, коротко, может снова заснуть
  if (ctx.presence?.nightAwake) {
    // 15% шанс просто игнорировать — снова уснула (снижено с 40%)
    if (Math.random() < 0.15) {
      return {
        shouldReply: false,
        shouldRead: false,
        delaySec: 0,
        bubbles: 1,
        typing: false,
        ignoreReason: "night-fell-asleep",
        moodDelta: { annoyance: 5 },
        intent: "ignore"
      };
    }
    // Иначе ответ — но короткий и медленный
    const parsed = await llm.chat(
      [{ role: "system", content: SYS }, { role: "user", content: TEMPLATE(state, history, incoming, ctx, reactionsHint) }],
      { temperature: 0.7, maxTokens: 3500, json: true }
    );
    const result = JSON.parse(parsed);
    return {
      shouldReply: true,
      shouldRead: true,
      delaySec: clamp(result.delaySec ?? 20, 10, 120),
      bubbles: 1,
      typing: result.typing ?? true,
      ignoreReason: undefined,
      moodDelta: result.moodDelta || { annoyance: 3 },
      intent: "short",
      reaction: undefined
    };
  }

  try {
    const raw = await llm.chat(
      [{ role: "system", content: SYS }, { role: "user", content: TEMPLATE(state, history, incoming, ctx, reactionsHint) }],
      { temperature: 0.7, maxTokens: 3500, json: true }
    );
    const parsed = JSON.parse(raw);

    // Sanitize реакцию по правилам warm/cold
    let reaction: string | undefined = typeof parsed.reaction === "string" && parsed.reaction.length > 0 && parsed.reaction.length <= 4
      ? parsed.reaction : undefined;
    if (reaction) {
      reaction = sanitizeReaction(reaction, cfg.stage, rel.score);
    }

    return {
      shouldReply: !!parsed.shouldReply && parsed.intent !== "ignore" && parsed.intent !== "left-on-read" && parsed.intent !== "reaction-only",
      shouldRead: parsed.shouldRead ?? true,
      delaySec: clamp(parsed.delaySec ?? 30, 0, 3600),
      bubbles: clamp(parsed.bubbles ?? 1, 1, 6),
      typing: parsed.typing ?? true,
      ignoreReason: parsed.ignoreReason || undefined,
      moodDelta: parsed.moodDelta || {},
      intent: parsed.intent || "reply",
      reaction
    };
  } catch {
    const ignore = Math.random() < stage.defaults.ignoreChance * vibeIgnoreMul;
    const [lo, hi] = stage.defaults.replyDelaySec;
    return {
      shouldReply: !ignore,
      shouldRead: true,
      delaySec: clamp(lo + Math.random() * (hi - lo), 0, 3600),
      bubbles: 1,
      typing: true,
      moodDelta: {},
      intent: ignore ? "ignore" : "reply"
    };
  }
}

function sanitizeReaction(emoji: string, stage: string, score: { attraction: number; annoyance: number }): string | undefined {
  const isWarm = score.attraction > 30 || ["dating-early", "dating-stable", "long-term"].includes(stage);
  const isCold = score.annoyance > 40 || stage === "tg-given-cold";
  const FORBIDDEN_WHEN_WARM = new Set(["🤡", "💀", "🤮", "🖕", "😐", "🙄"]);
  const FORBIDDEN_WHEN_COLD = new Set(["❤", "❤️", "🥰", "🥹", "🥺", "🔥"]);
  if (isWarm && FORBIDDEN_WHEN_WARM.has(emoji)) {
    // подменяем на адекватную тёплую
    return ["😂", "❤", "🥹"][Math.floor(Math.random() * 3)];
  }
  if (isCold && FORBIDDEN_WHEN_COLD.has(emoji)) {
    return ["👍", "😐", "🤔"][Math.floor(Math.random() * 3)];
  }
  return emoji;
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, Number(n) || 0));
}
