
git add .
if ($?) { git commit -m "Deploy pending fixes and date format update" }
if ($?) { git push origin main }
