import fs from 'fs';
import path from 'path';

const analyze = () => {
    const csvPath = path.resolve('bulkUpdate/trans-kha-virt.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');

    // IDs
    const MAIN_WALLET = '475ebdf9-5c4d-43a3-b20d-4e1491da0247';
    // Khaled Virt: cea05e1d-6207-4611-8676-13454b2eb746
    const KHA_VIRT = 'cea05e1d-6207-4611-8676-13454b2eb746';

    let netChange = 0;

    // Scenarios
    // 1. Raw sum (taking sign into account)
    // 2. Abs sum (taking direction into account)

    let rawSum = 0;
    let absSum = 0;
    let ignoredNegatives = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        // id,user_id,date,amount,type,from_wallet_id,to_wallet_id,...
        const amountStr = cols[3];
        const fromId = cols[5];
        const toId = cols[6];

        const amount = parseFloat(amountStr);
        if (isNaN(amount)) continue;

        // Effect on KHA_VIRT
        let effect = 0;

        // Logic 1: Trust From/To and Amount Sign
        if (toId === KHA_VIRT) {
            effect += amount;
        } else if (fromId === KHA_VIRT) {
            effect -= amount;
        }

        rawSum += effect;

        // Logic 2: Trust From/To, Assume Amount is Positive
        let absEffect = 0;
        const absAm = Math.abs(amount);
        if (toId === KHA_VIRT) {
            absEffect += absAm;
        } else if (fromId === KHA_VIRT) {
            absEffect -= absAm;
        }
        absSum += absEffect;
    }

    console.log(`Target: 318,669`);
    console.log(`Raw Sum (respecting signs in CSV): ${rawSum}`);
    console.log(`Abs Sum (forcing positive amounts): ${absSum}`);

    // Logic 3: Maybe duplicates were included/excluded differently?
    // Let's print out the raw sum.
};

analyze();
