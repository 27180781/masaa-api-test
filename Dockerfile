# התחל מתמונת בסיס רשמית של Node.js
FROM node:20

# התקן את ספריות המערכת הנדרשות + חבילת פונטים בעברית
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-noto-hebrew

# קבע את ספריית העבודה בתוך הקונטיינר
WORKDIR /app

# העתק את קבצי התלויות והתקן אותן
COPY package*.json ./
RUN npm install --production

# העתק את שאר קבצי האפליקציה
COPY . .

# חשוף את הפורט שהאפליקציה מאזינה לו
EXPOSE 3000

# הגדר את הפקודה שתריץ את האפליקציה
CMD [ "node", "index.js" ]