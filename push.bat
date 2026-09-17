@echo off
title Push SmartFulfill to GitHub
echo =======================================================
echo Pushing SmartFulfill to smart-warehouse-management...
echo =======================================================
echo.
git remote remove origin 2>nul
git remote add origin https://github.com/Akshitha200728/smart-warehouse-management.git
git branch -M main
git push -u origin main
echo.
echo =======================================================
echo Push operation completed.
echo =======================================================
pause
