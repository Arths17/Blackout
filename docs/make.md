make zip

cd /Users/atharvranjan/Blackout && npm run zip

send to itch

brew install --cask itch # or download butler from <https://itchio.itch.io/butler>\
butler login

\
\
Then push the built folder or the zip:

butler push dist arth17/blackout:html5

or

butler push [blackout-html5.zip](http://blackout-html5.zip) arth17/blackout:html5