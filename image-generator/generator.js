const { createCanvas, loadImage } = require('canvas'); // ⭐️ הוספה: ייבוא loadImage
const { COLORS, FONTS, LAYOUT } = require('./config.js');

/**
 * יוצר תמונת סיכום משחק (גרף עמודות)
 * @param {string} gameId - מזהה המשחק
 * @param {object} profile - אובייקט עם הפרופיל הממוצע
 * @returns {Promise<Canvas>} - אובייקט Canvas מוכן להזרמה
 */
async function createGameSummaryImage(gameId, profile) { // ⭐️ הפיכת הפונקציה ל-async
    const { width, height, backgroundImagePath, barWidth, barMargin, chartHeight } = LAYOUT.summaryChart;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    // 1. טעינה וציור של תמונת הרקע
    const background = await loadImage(backgroundImagePath); // ⭐️ טעינה אסינכרונית של התמונה
    context.drawImage(background, 0, 0, width, height); // ⭐️ ציור התמונה על כל הקנבס

    // 2. כותרת - שימוש בפונט החדש
    context.fillStyle = COLORS.title;
    context.font = FONTS.title;
    context.textAlign = 'center';
    context.fillText(`סיכום תוצאות למשחק: ${gameId}`, width / 2, 100); // מיקום מותאם לגודל החדש

    // 3. ציור הגרף
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

    elements.forEach((element, index) => {
        const barHeight = (profile[element] / 100) * chartHeight;
        const x = startX + index * (barWidth + barMargin);
        const y = height - 150 - barHeight; // מיקום מותאם לגודל החדש
        
        context.fillStyle = COLORS.elements[element] || COLORS.elements.default;
        context.fillRect(x, y, barWidth, barHeight);

        context.fillStyle = COLORS.text;
        context.font = FONTS.percentage;
        context.fillText(`${profile[element].toFixed(1)}%`, x + barWidth / 2, y - 20);

        context.font = FONTS.label;
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;
        context.fillText(hebrewElement, x + barWidth / 2, height - 100);
    });

    return canvas;
}

module.exports = {
    createGameSummaryImage
};