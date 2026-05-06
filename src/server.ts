import { Runtime } from "./engine/runtime.js";
import fs from "fs";

async function serverMain() {
    console.log("=== ЗАПУСК СЕРВЕРА ===");

    if (!fs.existsSync("config.json")) {
        console.error("ОШИБКА: config.json не найден!");
        process.exit(1);
    }

    const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    console.log(`>>> ПРОФИЛЬ: ${cfg.name} | РЕЖИМ: ${cfg.mode || 'bot'} <<<`);

    const rt = new Runtime(cfg);

    // Этот лог сработает ГАРАНТИРОВАННО при запуске
    console.log("Инициализация Runtime...");

    await rt.start();
    
    // Попробуем достать логгер из самого Runtime
    console.log("Бот онлайн. Если логов нет при сообщениях — проверь ownerId в конфиге.");

    process.on("SIGINT", async () => {
        await rt.stop();
        process.exit(0);
    });
}

serverMain().catch((err) => console.error("ОШИБКА:", err));
