# DauberSide Project

Welcome to the DauberSide Project. This project is deployed using Vercel and utilizes Next.js for the frontend.

## Table of Contents

- [Installation](#installation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/dauberside/dauberside.github.io.git
   ```
2. Navigate to the project directory:
   ```sh
   cd dauberside.github.io
   ```
3. Install dependencies:
   ```sh
   npm install
   ```

## Development

To start the development server, run:

````sh
npm run dev

### 手順2: プロジェクトの整理
以下のようにディレクトリ構造を整理し、必要なファイルを適切な場所に配置します。

#### ディレクトリ構造

dauberside.github.io/
├── .github/
│ └── workflows/
│ └── cleanup.yml
├── .gitignore
├── .next/
├── .vercel/
├── backup-repo.git/
├── node_modules/
├── pages/
│ ├── _app.js
│ ├── about.js
│ ├── contact.js
│ └── index.js
├── public/
│ ├── images/
│ └── css/
├── src/
│ ├── components/
│ │ ├── Header.js
│ │ └── Footer.js
│ ├── styles/
│ │ └── global.css
│ └── utils/
├── package.json
├── package-lock.json
├── README.md
└── vercel.json

### 手順3: コミットとプッシュ
すべての変更をステージングし、コミットしてリモートリポジトリにプッシュします。

```bash
git add .
git commit -m "Add README.md and organize project structure"
git push origin master
````
