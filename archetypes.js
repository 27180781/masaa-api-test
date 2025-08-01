// archetypes.js
const archetypes = [
    { type_id: 1, name: "היוזם הדומיננטי", profile: { fire: 85, water: 5, air: 5, earth: 5 } },
    { type_id: 2, name: "המכיל הרגיש", profile: { fire: 5, water: 85, air: 5, earth: 5 } },
    { type_id: 3, name: "הוגה הדעות החדשני", profile: { fire: 5, water: 5, air: 85, earth: 5 } },
    { type_id: 4, name: "המבצע היסודי", profile: { fire: 5, water: 5, air: 5, earth: 85 } },
    { type_id: 5, name: "Type 5", profile: { fire: 70, water: 15, air: 10, earth: 5 } },
    { type_id: 6, name: "Type 6", profile: { fire: 70, water: 10, air: 15, earth: 5 } },
    { type_id: 7, name: "Type 7", profile: { fire: 70, water: 5, air: 10, earth: 15 } },
    { type_id: 8, name: "Type 8", profile: { fire: 15, water: 70, air: 10, earth: 5 } },
    { type_id: 9, name: "Type 9", profile: { fire: 10, water: 70, air: 15, earth: 5 } },
    { type_id: 10, name: "Type 10", profile: { fire: 5, water: 70, air: 10, earth: 15 } },
    { type_id: 11, name: "Type 11", profile: { fire: 15, water: 10, air: 70, earth: 5 } },
    { type_id: 12, name: "Type 12", profile: { fire: 10, water: 15, air: 70, earth: 5 } },
    { type_id: 13, name: "Type 13", profile: { fire: 5, water: 10, air: 70, earth: 15 } },
    { type_id: 14, name: "Type 14", profile: { fire: 15, water: 5, air: 10, earth: 70 } },
    { type_id: 15, name: "Type 15", profile: { fire: 10, water: 5, air: 15, earth: 70 } },
    { type_id: 16, name: "Type 16", profile: { fire: 5, water: 15, air: 10, earth: 70 } },
    { type_id: 17, name: "Type 17", profile: { fire: 45, water: 45, air: 5, earth: 5 } },
    { type_id: 18, name: "Type 18", profile: { fire: 45, water: 5, air: 45, earth: 5 } },
    { type_id: 19, name: "Type 19", profile: { fire: 45, water: 5, air: 5, earth: 45 } },
    { type_id: 20, name: "Type 20", profile: { fire: 5, water: 45, air: 45, earth: 5 } },
    { type_id: 21, name: "Type 21", profile: { fire: 5, water: 45, air: 5, earth: 45 } },
    { type_id: 22, name: "Type 22", profile: { fire: 5, water: 5, air: 45, earth: 45 } },
    { type_id: 23, name: "Type 23", profile: { fire: 50, water: 40, air: 5, earth: 5 } },
    { type_id: 24, name: "Type 24", profile: { fire: 40, water: 50, air: 5, earth: 5 } },
    { type_id: 25, name: "Type 25", profile: { fire: 60, water: 30, air: 5, earth: 5 } },
    { type_id: 26, name: "Type 26", profile: { fire: 50, water: 5, air: 40, earth: 5 } },
    { type_id: 27, name: "Type 27", profile: { fire: 40, water: 5, air: 50, earth: 5 } },
    { type_id: 28, name: "Type 28", profile: { fire: 60, water: 5, air: 30, earth: 5 } },
    { type_id: 29, name: "Type 29", profile: { fire: 50, water: 5, air: 5, earth: 40 } },
    { type_id: 30, name: "Type 30", profile: { fire: 40, water: 5, air: 5, earth: 50 } },
    { type_id: 31, name: "Type 31", profile: { fire: 60, water: 5, air: 5, earth: 30 } },
    { type_id: 32, name: "Type 32", profile: { fire: 5, water: 50, air: 40, earth: 5 } },
    { type_id: 33, name: "Type 33", profile: { fire: 5, water: 40, air: 50, earth: 5 } },
    { type_id: 34, name: "Type 34", profile: { fire: 5, water: 60, air: 30, earth: 5 } },
    { type_id: 35, name: "Type 35", profile: { fire: 5, water: 50, air: 5, earth: 40 } },
    { type_id: 36, name: "Type 36", profile: { fire: 5, water: 40, air: 5, earth: 50 } },
    { type_id: 37, name: "Type 37", profile: { fire: 5, water: 60, air: 5, earth: 30 } },
    { type_id: 38, name: "Type 38", profile: { fire: 5, water: 5, air: 50, earth: 40 } },
    { type_id: 39, name: "Type 39", profile: { fire: 5, water: 5, air: 40, earth: 50 } },
    { type_id: 40, name: "Type 40", profile: { fire: 5, water: 5, air: 60, earth: 30 } },
    { type_id: 41, name: "Type 41", profile: { fire: 25, water: 25, air: 25, earth: 25 } },
    { type_id: 42, name: "Type 42", profile: { fire: 30, water: 30, air: 20, earth: 20 } },
    { type_id: 43, name: "Type 43", profile: { fire: 30, water: 20, air: 30, earth: 20 } },
    { type_id: 44, name: "Type 44", profile: { fire: 30, water: 20, air: 20, earth: 30 } },
    { type_id: 45, name: "Type 45", profile: { fire: 20, water: 30, air: 30, earth: 20 } },
    { type_id: 46, name: "Type 46", profile: { fire: 20, water: 30, air: 20, earth: 30 } },
    { type_id: 47, name: "Type 47", profile: { fire: 20, water: 20, air: 30, earth: 30 } },
    { type_id: 48, name: "Type 48", profile: { fire: 35, water: 25, air: 25, earth: 15 } },
    { type_id: 49, name: "Type 49", profile: { fire: 25, water: 35, air: 15, earth: 25 } },
    { type_id: 50, name: "Type 50", profile: { fire: 25, water: 15, air: 35, earth: 25 } },
    { type_id: 51, name: "Type 51", profile: { fire: 15, water: 25, air: 25, earth: 35 } },
    { type_id: 52, name: "Type 52", profile: { fire: 40, water: 30, air: 20, earth: 10 } },
    { type_id: 53, name: "Type 53", profile: { fire: 10, water: 20, air: 30, earth: 40 } },
    { type_id: 54, name: "Type 54", profile: { fire: 40, water: 10, air: 30, earth: 20 } },
    { type_id: 55, name: "Type 55", profile: { fire: 33, water: 33, air: 33, earth: 1 } },
    { type_id: 56, name: "Type 56", profile: { fire: 33, water: 33, air: 1, earth: 33 } },
    { type_id: 57, name: "Type 57", profile: { fire: 33, water: 1, air: 33, earth: 33 } },
    { type_id: 58, name: "Type 58", profile: { fire: 1, water: 33, air: 33, earth: 33 } },
    { type_id: 59, name: "Type 59", profile: { fire: 40, water: 40, air: 15, earth: 5 } },
    { type_id: 60, name: "Type 60", profile: { fire: 40, water: 15, air: 40, earth: 5 } },
    { type_id: 61, name: "Type 61", profile: { fire: 15, water: 40, air: 40, earth: 5 } },
    { type_id: 62, name: "Type 62", profile: { fire: 40, water: 5, air: 15, earth: 40 } },
    { type_id: 63, name: "Type 63", profile: { fire: 5, water: 40, air: 15, earth: 40 } },
    { type_id: 64, name: "Type 64", profile: { fire: 15, water: 5, air: 40, earth: 40 } },
    { type_id: 65, name: "Type 65", profile: { fire: 50, water: 25, air: 20, earth: 5 } },
    { type_id: 66, name: "Type 66", profile: { fire: 25, water: 50, air: 5, earth: 20 } },
    { type_id: 67, name: "Type 67", profile: { fire: 20, water: 5, air: 50, earth: 25 } },
    { type_id: 68, name: "Type 68", profile: { fire: 5, water: 25, air: 20, earth: 50 } },
    { type_id: 69, name: "Type 69", profile: { fire: 60, water: 20, air: 10, earth: 10 } },
    { type_id: 70, name: "Type 70", profile: { fire: 20, water: 60, air: 10, earth: 10 } },
    { type_id: 71, name: "Type 71", profile: { fire: 10, water: 10, air: 60, earth: 20 } },
    { type_id: 72, name: "Type 72", profile: { fire: 10, water: 10, air: 20, earth: 60 } },
    { type_id: 73, name: "Type 73", profile: { fire: 48, water: 2, air: 48, earth: 2 } },
    { type_id: 74, name: "Type 74", profile: { fire: 2, water: 48, air: 2, earth: 48 } },
    { type_id: 75, name: "Type 75", profile: { fire: 48, water: 48, air: 2, earth: 2 } },
    { type_id: 76, name: "Type 76", profile: { fire: 2, water: 2, air: 48, earth: 48 } },
    { type_id: 77, name: "Type 77", profile: { fire: 49, water: 49, air: 1, earth: 1 } },
    { type_id: 78, name: "Type 78", profile: { fire: 1, water: 1, air: 49, earth: 49 } },
    { type_id: 79, name: "Type 79", profile: { fire: 40, water: 20, air: 10, earth: 30 } },
    { type_id: 80, name: "Type 80", profile: { fire: 30, water: 10, air: 20, earth: 40 } },
    { type_id: 81, name: "Type 81", profile: { fire: 20, water: 40, air: 30, earth: 10 } },
    { type_id: 82, name: "Type 82", profile: { fire: 10, water: 30, air: 40, earth: 20 } },
    { type_id: 83, name: "Type 83", profile: { fire: 55, water: 15, air: 15, earth: 15 } },
    { type_id: 84, name: "Type 84", profile: { fire: 15, water: 55, air: 15, earth: 15 } },
    { type_id: 85, name: "Type 85", profile: { fire: 15, water: 15, air: 55, earth: 15 } },
    { type_id: 86, name: "Type 86", profile: { fire: 15, water: 15, air: 15, earth: 55 } },
    { type_id: 87, name: "Type 87", profile: { fire: 28, water: 28, air: 22, earth: 22 } },
    { type_id: 88, name: "Type 88", profile: { fire: 22, water: 22, air: 28, earth: 28 } },
    { type_id: 89, name: "Type 89", profile: { fire: 32, water: 18, air: 32, earth: 18 } },
    { type_id: 90, name: "Type 90", profile: { fire: 18, water: 32, air: 18, earth: 32 } },
    { type_id: 91, name: "Type 91", profile: { fire: 65, water: 5, air: 25, earth: 5 } },
    { type_id: 92, name: "Type 92", profile: { fire: 5, water: 65, air: 5, earth: 25 } },
    { type_id: 93, name: "Type 93", profile: { fire: 25, water: 5, air: 65, earth: 5 } },
    { type_id: 94, name: "Type 94", profile: { fire: 5, water: 25, air: 5, earth: 65 } },
    { type_id: 95, name: "Type 95", profile: { fire: 38, water: 38, air: 12, earth: 12 } },
    { type_id: 96, name: "Type 96", profile: { fire: 12, water: 12, air: 38, earth: 38 } },
    { type_id: 97, name: "Type 97", profile: { fire: 38, water: 12, air: 38, earth: 12 } },
    { type_id: 98, name: "Type 98", profile: { fire: 12, water: 38, air: 12, earth: 38 } },
    { type_id: 99, name: "Type 99", profile: { fire: 5, water: 15, air: 35, earth: 45 } },
    { type_id: 100, name: "Type 100", profile: { fire: 45, water: 35, air: 15, earth: 5 } },
    { type_id: 101, name: "Type 101", profile: { fire: 45, water: 25, air: 25, earth: 5 } },
    { type_id: 102, name: "Type 102", profile: { fire: 5, water: 45, air: 25, earth: 25 } },
    { type_id: 103, name: "Type 103", profile: { fire: 25, water: 5, air: 45, earth: 25 } },
    { type_id: 104, name: "Type 104", profile: { fire: 25, water: 25, air: 5, earth: 45 } },
    { type_id: 105, name: "Type 105", profile: { fire: 5, water: 40, air: 35, earth: 20 } },
    { type_id: 106, name: "Type 106", profile: { fire: 40, water: 5, air: 35, earth: 20 } },
    { type_id: 107, name: "Type 107", profile: { fire: 40, water: 35, air: 5, earth: 20 } },
    { type_id: 108, name: "Type 108", profile: { fire: 40, water: 35, air: 20, earth: 5 } }
];

module.exports = archetypes;