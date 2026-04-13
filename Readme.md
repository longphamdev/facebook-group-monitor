
rsync -a --progress --mkpath \
"$HOME/Library/Application Support/Google/Chrome/Profile 9/" \
"$HOME/.chrome-dev-cdp/Profile 9/"

"/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev" \
 --remote-debugging-port=9223 \
 --user-data-dir="$HOME/.chrome-dev-cdp" \
 --profile-directory="Profile 9"

# Verify CDP locally (works)

curl http://127.0.0.1:9223/json/version

CHROME_CDP_URL=http://127.0.0.1:9223

