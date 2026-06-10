/**
 * Script standalone — génère et envoie le rapport quotidien
 * Usage: node scripts/daily-report.js
 * Cron: 0 8 * * * node /path/to/scripts/daily-report.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { generateDailyReport } = require('../agents/analytics-agent');
const { sendWhatsAppMessage } = require('../agents/whatsapp-agent');

async function run() {
  console.log('📊 Génération rapport quotidien Denti Luxe...');

  try {
    const report = await generateDailyReport();
    console.log('\n' + report.report);

    if (process.env.OWNER_WHATSAPP) {
      const result = await sendWhatsAppMessage(process.env.OWNER_WHATSAPP, report.report);
      console.log('\nEnvoi WhatsApp:', result.success ? '✅' : '❌');
    }

    console.log('\nDonnées brutes:');
    console.log('- Commission 30j:', report.data?.revenue?.total_commission?.toFixed(0), 'DH');
    console.log('- ROAS 30j:', report.roas30?.roas + 'x');
    console.log('- Leads chauds:', report.hotLeads);

  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

run();
