const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

// פונקציית עזר כללית לטקסט (לרוב ממורכז)
function createTextSvg(text, font, color, width, height) {
    const [fontFamily, weight, size] = font.split(' ');
    let strokeStyle = '';
    if (color.toLowerCase() !== '#ffffff') {
        strokeStyle = `
         stroke: white;
         stroke-width: 8px;
         paint-order: stroke fill;
        `;
    }
    return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; text-align: center; ${strokeStyle} }
      </style>
      <text x="50%" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
    </svg>`);
}

// ⭐️ פונקציית עזר חדשה לטקסט מימין לשמאל
function createRtlTextSvg(text, font, color, width, height) {
    const [fontFamily, weight, size] = font.split(' ');
    // אין צורך במסגרת לבנה לשמות המשתתפים
    return Buffer.from(`
    <svg width="${width}" height="${height}" direction="rtl">
      <style>
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; }
      </style>
      <text x="100%" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="end" class="title">${text}</text>
    </svg>`);
}


// פונקציית עזר לפס התפלגות
function createDistributionBarSvg(profile, width, height) {
    const segments = [];
    let accumulatedWidth = 0;
    const elements = ['fire', 'water', 'air', 'earth'];

    for (const element of elements) {
        const percent = profile[element] || 0;
        if (percent > 0) {
            const segmentWidth = (percent / 100) * width;
            segments.push(`<rect x="${accumulatedWidth}" y="0" width="${segmentWidth}" height="${height}" fill="${COLORS.elements[element]}" />`);
            accumulatedWidth += segmentWidth;
        }
    }
    return Buffer.from(`<svg width="${width}" height="${height}">${segments.join('')}</svg>`);
}


// --- פונקציות ייצוא ---

async function createGameSummaryImage(profile) {
    // ... קוד קיים ...
}

async function createLicenseStatusImage(status) {
    // ... קוד קיים ...
}

async function createGroupBreakdownImage(groups) {
    // ... קוד קיים ...
}

// ⭐️ פונקציה מעודכנת עבור רשימת המשתתפים
async function createParticipantListImage(participants) {
    const config = LAYOUT.participantList;
    const { width, height, backgroundImagePath, padding, barWidth, barHeight, rowGap } = config;

    if (!participants || participants.length === 0) {
        const noDataSvg = createTextSvg('לא נמצאו משתתפים להצגה', FONTS.noDataMessage, COLORS.title, width, height);
        return sharp(backgroundImagePath).resize(width, height).composite([{ input: noDataSvg }]).toBuffer();
    }

    const compositeLayers = [];
    const legendHeight = 80;

    const legendItems = [];
    const hebrewElements = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' };
    let legendX = padding;
    for (const element of ['fire', 'water', 'air', 'earth']) {
        const colorSquare = sharp({ create: { width: 30, height: 30, channels: 4, background: COLORS.elements[element] } }).png().toBuffer();
        const textSvg = createTextSvg(hebrewElements[element], FONTS.legendText, COLORS.text, 100, 40);
        legendItems.push({ input: await colorSquare, top: padding - 20, left: legendX });
        legendItems.push({ input: textSvg, top: padding - 25, left: legendX + 35 });
        legendX += 150;
    }
    compositeLayers.push(...legendItems);

    const maxCols = 5;
    const availableWidth = width - padding * 2;
    const colWidth = availableWidth / maxCols;
    const rows = Math.ceil(participants.length / maxCols);
    
    const availableHeight = height - legendHeight - padding;
    let rowHeight = availableHeight / rows;
    let fontSize = parseInt(FONTS.participantName.split(' ')[2]);
    if (rowHeight < 50) {
        fontSize = Math.max(18, Math.floor(fontSize * (rowHeight / 50)));
    }
    const dynamicFont = `FbKanuba Bold ${fontSize}`;

    for (const [index, participant] of participants.entries()) {
        const row = Math.floor(index / maxCols);
        const col = index % maxCols;
        
        const x = padding + col * colWidth;
        const y = legendHeight + row * (barHeight + rowGap + 10); // הוספת ריווח קטן

        const nameWidth = colWidth - barWidth - 30; // רווח לשם + ריווח קטן

        // ⭐️ שינוי סדר ושימוש בפונקציית RTL
        // שם המשתתף (מימין)
        compositeLayers.push({
            input: createRtlTextSvg(participant.name, dynamicFont, COLORS.text, nameWidth, barHeight),
            top: y,
            left: x + barWidth + 20 // מיקום מימין לפס
        });

        // פס התפלגות (משמאל)
        compositeLayers.push({
            input: createDistributionBarSvg(participant.profile, barWidth, barHeight),
            top: y,
            left: x
        });
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height)
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}


module.exports = {
    createGameSummaryImage,
    createLicenseStatusImage,
    createGroupBreakdownImage,
    createParticipantListImage
};