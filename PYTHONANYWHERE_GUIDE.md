# Инструкция по развертыванию Orbit на PythonAnywhere и GitHub

Данный репозиторий полностью подготовлен для развертывания как в контейнере/Node.js, так и на платформе **PythonAnywhere.com**.

---

## Вариант 1. Скачивание и выгрузка в GitHub

### Экспорт из AI Studio:
1. В верхнем/боковом меню AI Studio откройте **Settings (Настройки)** или **Export**.
2. Выберите **Export to GitHub** (автоматическая выгрузка в ваш репозиторий) или **Download ZIP** (для скачивания архива на ПК).

### Для ручной загрузки в свой GitHub репозиторий через Git CLI:
```bash
git init
git add .
git commit -m "Orbit app with offline PWA, Story creator and PythonAnywhere backend support"
git branch -M main
git remote add origin https://github.com/ВАШ_ПОЛЬЗОВАТЕЛЬ/orbit-app.git
git push -u origin main
```

---

## Вариант 2. Развертывание на PythonAnywhere.com

### Шаг 1: Клонирование репозитория на PythonAnywhere
1. Зарегистрируйтесь / войдите на **pythonanywhere.com**.
2. Перейдите во вкладку **Consoles** и откройте **Bash console**.
3. Склонируйте ваш репозиторий с GitHub:
```bash
git clone https://github.com/ВАШ_ПОЛЬЗОВАТЕЛЬ/orbit-app.git
cd orbit-app
```

### Шаг 2: Создание и активация virtualenv
В консоли PythonAnywhere выполните:
```bash
mkvirtualenv --python=/usr/bin/python3.10 orbit-env
pip install -r requirements.txt
```

### Шаг 3: Сборка фронтенда React SPA (один раз)
Если на PythonAnywhere у вас есть Node.js:
```bash
npm install
npm run build
```
*(Или вы можете собрать проект командой `npm run build` локально и отправить папку `dist/` в репозиторий GitHub).*

### Шаг 4: Настройка веб-приложения в панели PythonAnywhere
1. Перейдите во вкладку **Web** в панели управления PythonAnywhere.
2. Нажмите **Add a new web app**.
3. Выберите **Manual configuration** (Ручная конфигурация) -> **Python 3.10**.
4. В поле **Virtualenv** укажите путь к созданной виртуальной среде:
   `/home/ВАШ_ЛОГИН/.virtualenvs/orbit-env`
5. В секции **Code**:
   - **Source code**: `/home/ВАШ_ЛОГИН/orbit-app`
   - **Working directory**: `/home/ВАШ_ЛОГИН/orbit-app`
   - Нажмите на ссылку **WSGI configuration file** (`/var/www/ВАШ_ЛОГИН_pythonanywhere_com_wsgi.py`) и замените его содержимое на:

```python
import sys
import os

path = '/home/ВАШ_ЛОГИН/orbit-app'
if path not in sys.path:
    sys.path.append(path)

from app import app as application
```

6. Нажмите зеленый кружок **Reload <ваш-логин>.pythonanywhere.com** вверху страницы Web.

Готово! Ваше веб-приложение Orbit работает по адресу `https://<ваш-логин>.pythonanywhere.com`.
