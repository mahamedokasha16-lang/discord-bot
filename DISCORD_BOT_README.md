# Black Discord Bot

## المتطلبات

- Node.js 20 أو أحدث
- pnpm
- Discord Bot Token
- FFmpeg (مطلوب لتشغيل الموسيقى في بعض البيئات)

## التشغيل

1. فك ضغط الملفات.
2. نفّذ:

```bash
pnpm install
```

3. أضف التوكن كمتغير بيئة، ولا تضعه داخل الكود:

```bash
export DISCORD_BOT_TOKEN="ضع_التوكن_هنا"
```

4. شغّل البوت:

```bash
pnpm --filter @workspace/scripts run bot
```

## التشغيل 24 ساعة باستخدام PM2

```bash
npm install -g pm2
pm2 start "pnpm --filter @workspace/scripts run bot" --name black-discord-bot
pm2 save
pm2 startup
```

نفّذ الأمر الذي سيطبعه `pm2 startup` مرة واحدة على السيرفر حتى يعود البوت تلقائيًا بعد إعادة التشغيل.

## الملفات المهمة

- `scripts/src/discord-bot.ts` — كود البوت والأوامر والألعاب والموسيقى
- `scripts/package.json` — المكتبات وأمر التشغيل
- `scripts/tsconfig.json` — إعداد TypeScript
- `pnpm-workspace.yaml` — إعداد pnpm

## الأمان

لا تشارك `DISCORD_BOT_TOKEN` مع أي شخص. إذا ظهر التوكن في مكان عام، اعمل له Reset من Discord Developer Portal فورًا.