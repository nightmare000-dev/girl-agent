import { Runtime } from "./engine/runtime.js";
import fs from "fs";

async function serverMain() {
    console.log("=== ЗАПУСК СЕРВЕРА ===");

    if (!fs.existsSync("config.json")) {
        console.error("ОШИБКА: config.json не найден в корне проекта!");
        process.exit(1);
    }

    const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    console.log(`>>> ПРОФИЛЬ: ${cfg.name} <<<`);

    const runtimeInstance = new Runtime(cfg);

    // Безопасный дебаг через 5 секунд после старта
    setTimeout(() => {
        const bot = (runtimeInstance as any).bot;
        if (bot) {
            console.log("Система отладки ТГ активна. Ожидаю сообщений...");
            bot.on('message', (ctx: any) => {
                console.log(`[LOG] Получено от ${ctx.from?.id}: ${ctx.message?.text || 'не текст'}`);
            });
        } else {
            console.log("Предупреждение: Экземпляр бота не найден (возможно, режим userbot).");
        }
    }, 5000);

    await runtimeInstance.start();
    console.log("Бот официально онлайн!");

    process.on("SIGINT", async () => {
        await runtimeInstance.stop();
        process.exit(0);
    });
}

serverMain().catch((err) => {
    console.error("КРИТИЧЕСКАЯ ОШИБКА РАБОТЫ:", err);
});
