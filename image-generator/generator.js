const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

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
    
    const titleSvg = createTextSvg(
        `סיכום תוצאות למשחק: ${gameId}`,
        FONTS.title,
        COLORS.title,
        width,
        150
    );

    const compositeLayers = [
        { input: titleSvg, top: 0, left: 0 }
    ];
    
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

    // החלפת forEach בלולאת for...of שתומכת ב-await
    let index = 0;
    for (const element of elements) {
        const barHeight = (profile[element] / 100) * chartHeight;
        const x = startX + index * (barWidth + barMargin);
        const y = height - 150 - barHeight;
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;

        const barBuffer = await sharp({ // 'await' עובד כהלכה בתוך הלולאה הזו
            create: {
                width: barWidth,
                height: Math.round(barHeight),
                channels: 4,
                background: COLORS.elements[element] || COLORS.elements.default
            }
        }).png().toBuffer();

        compositeLayers.push({
            input: barBuffer,
            top: Math.round(y),
            left: Math.round(x)
        });

        compositeLayers.push({
            input: createTextSvg(`${profile[element].toFixed(1)}%`, FONTS.percentage, COLORS.text, barWidth, 40),
            top: Math.round(y - 50),
            left: Math.round(x)
        });

        compositeLayers.push({
            input: createTextSvg(hebrewElement, FONTS.label, COLORS.text, barWidth, 50),
            top: Math.round(height - 120),
            left: Math.round(x)
        });

        index++; // קידום האינדקס באופן ידני
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}

module.exports = {
    createGameSummaryImage
};