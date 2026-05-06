/**
 * MarkdownV2 escaping for Telegram Bot API / MTProto.
 *
 * Reserved chars: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * All must be preceded by '\' when used as literal text.
 */

const MD2_RESERVED = /([_*\[\]()~`>#+\-=|{}.!\\])/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(MD2_RESERVED, "\\$1");
}
