import { Runtime } from "./engine/runtime.js";
import { readConfig, listProfiles } from "./storage/md.js";

async function main() {
  // 1. Ищем профили в папке data/profiles
  const profiles = await listProfiles();
  
  if (profiles.length === 0) {
    console.error("ОШИБКА: Профили не найдены в папке data/profiles!");
    console.log("Если ты используешь Secret Files, убедись, что путь указан как data/profiles/default.json");
    process.exit(1);
  }

  // 2. Читаем первый конфиг
  const cfg = await readConfig(profiles[0]);
  
  if (cfg) {
    console.log(`>>> СЕРВЕРНЫЙ ЗАПУСК: ${cfg.name} <<<`);
    
    // 3. Запускаем ТОЛЬКО рантайм (логику), без Dashboard!
    const rt = new Runtime(cfg);
    await rt.start();
    
    console.log("Бот подключен к Telegram и слушает сообщения...");

    // Не даем процессу завершиться
    process.on("SIGINT", async () => {
      await rt.stop();
      process.exit(0);
    });
  }
}

main().catch((e) => {
  console.error("ФАТАЛЬНАЯ ОШИБКА:", e);
  process.exit(1);
});
