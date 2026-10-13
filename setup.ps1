npx -y create-vite@latest frontend --template react
cd frontend
npm install react-router-dom axios react-hook-form react-leaflet leaflet recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
cd ..
mkdir backend
cd backend
npm init -y
npm install express cors helmet morgan dotenv @prisma/client
npm install -D nodemon prisma jest supertest
npx prisma init
cd ..
