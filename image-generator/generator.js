const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

// פונקציית עזר ליצירת SVG של טקסט
function createTextSvg(text, font, color, width, height) {
    // פורמט הפונט חוזר להיות קלאסי
    const [fontFamily, weight, size] = font.split(' ');
    return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; }
      </style>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
    </svg>`);
}

async function createGameSummaryImage(gameId, profile) {
    const { width, height, backgroundImagePath, barWidth, barMargin, chartHeight } = LAYOUT.summaryChart;
    
    // הכנת שכבות הטקסט כ-SVG
    const titleSvg = createTextSvg(
        `סיכום תוצאות למשחק: ${gameId}`,
        FONTS.title,
        COLORS.title,
        width, // SVG ברוחב מלא
        150    // גובה אזור הכותרת
    );

    const elementLayers = [];
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

    elements.forEach((element, index) => {
        const x = startX + index * (barWidth + barMargin);
        const y = height - 150 - ((profile[element] / 100) * chartHeight);
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;

        // שכבת אחוזים
        elementLayers.push({
            input: createTextSvg(`${profile[element].toFixed(1)}%`, FONTS.percentage, COLORS.text, barWidth, 40),
            top: y - 50,
            left: x
        });

        // שכבת שם היסוד
        elementLayers.push({
            input: createTextSvg(hebrewElement, FONTS.label, COLORS.text, barWidth, 50),
            top: height - 120,
            left: x
        });
    });

    // הרכבת התמונה הסופית
    const finalImageBuffer = await sharp(backgroundImagePath)
        .composite([
            { input: titleSvg, top: 0, left: 0 },
            ...elementLayers
        ])
        .toBuffer();

    return finalImageBuffer;
}

module.exports = {
    createGameSummaryImage
};