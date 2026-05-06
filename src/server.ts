import { Runtime } from "./engine/runtime.js";
import { readConfig, listProfiles } from "./storage/md.js";

async function main() {
  const profiles = await listProfiles();
  
  if (profiles.length === 0) {
    console.error("Профилей не найдено! Сначала создай профиль на компе.");
    process.exit(1);
  }

  // Берем первый доступный профиль (твой созданный)
  const cfg = await readConfig(profiles[0]);
  
  if (cfg) {
    console.log(`Запускаю ядро для профиля: ${cfg.name} (без Dashboard)`);
    const rt = new Runtime(cfg);
    await rt.start();
    
    // Держим процесс живым
    process.on("SIGINT", async () => {
      await rt.stop();
      process.exit(0);
    });
  }
}

main().catch(console.error);
