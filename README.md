# Paper

The paper texture playground for reccos: the paper stocks, their grain, mottle and gloss, and the paper's hue and tint, with every number and paper color on a knob, in light and dark.

It's plain HTML, CSS and JavaScript, with no build step. Live at https://www.gomezjuliana.com/paper/ (GitHub Pages, from `main`, `/ (root)`).

## Run it locally

Browsers won't let a page opened straight from disk read `tokens.css`, so serve the folder:

```bash
python3 -m http.server 5174
```

Then open http://localhost:5174.

## Using it

It starts from its own copy of the tokens (`tokens.css`). **Use another tokens.css** loads a different one, such as the app's (`maps/app/src/app/tokens.css`), for this visit. A file without the tokens is turned away.

- **Save CSS** downloads `look.css`: lines to paste into the app's `tokens.css`.
- **Save look.json** downloads the paper colors, numbers, hue and tint, per mode. **Open a look.json** brings it back (looks saved by the older, bigger look tool open too).

## What's in here

- `index.html`: the page.
- `app.js`: the tool: reading `tokens.css`, the controls, the light/dark switch, and what Save writes.
- `paper.css`: a copy of the app's `components/ui/paper.module.css` (the paper material), as plain classes.
- `playground.css`: the tool's own layout and controls.
- `tokens.css`: a snapshot of the app's tokens, with one change: the light card stock is `paper-50` (white in the app) so it follows the paper hue. Keep that line when copying the app's tokens across.

The copied files don't update themselves. When the app's `paper.module.css` or `tokens.css` change, copy them across again.
