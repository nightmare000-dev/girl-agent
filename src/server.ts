import { Runtime } from "./engine/runtime.js";
import fs from "fs";

async function main() {
    console.log("Поиск конфигурации...");

    if (!fs.existsSync("config.json")) {
        console.error("ОШИБКА: config.json не найден в корне!");
        process.exit(1);
    }

    const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    console.log(`>>> ЗАПУСК: ${cfg.name} <<<`);

    const rt = new Runtime(cfg);

    // Тот самый DEBUG-код, чтобы видеть всё в логах
    // Мы проверяем наличие bot, так как в режиме userbot его может не быть
    setTimeout(() => {
        const botInstance = (rt as any).bot;
        if (botInstance) {
            console.log("Отладка Telegram активна. Слушаю сообщения...");
            botInstance.on('message', (ctx: any) => {
                console.log(`[DEBUG] Сообщение от ${ctx.from?.id}: ${ctx.message?.text || '[не текст]'}`);
            });
        }
    }, 5000); // Даем 5 секунд на инициализацию

    await rt.start();
    console.log("Бот онлайн!");

    process.on("SIGINT", async () => {
        await rt.stop();
        process.exit(0);
    });
}

main().catch(console.error);import { Runtime } from "./engine/runtime.js";
import fs from "fs";

async function main() {
    console.log("Поиск конфигурации...");

    let cfgRaw: string;

    // Сначала ищем файл config.json в корне (специально для Render)
    if (fs.existsSync("config.json")) {
        console.log("Нашел config.json в корне проекта.");
        cfgRaw = fs.readFileSync("config.json", "utf-8");
    } else {
        console.error("ОШИБКА: config.json не найден в корне!");
        process.exit(1);
    }

    const cfg = JSON.parse(cfgRaw);
    
    if (cfg) {
        console.log(`>>> СЕРВЕРНЫЙ ЗАПУСК: ${cfg.name} <<<`);
        const rt = new Runtime(cfg);
        // Это заставит бота орать в логи о любом шорохе
        const rt = new Runtime(cfg);

// Добавь этот костыль для отладки:
        (rt as any).bot?.on('message', (ctx: any) => {
            console.log(`[DEBUG] Пришло сообщение от ID: ${ctx.from?.id}, текст: ${ctx.message?.text}`);
        });
        await rt.start();
        console.log("Бот онлайн и готов к общению!");

        process.on("SIGINT", async () => {
            await rt.stop();
            process.exit(0);
        });
    }
}

main().catch(console.error);
