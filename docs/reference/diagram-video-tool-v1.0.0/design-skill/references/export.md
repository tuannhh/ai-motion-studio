# Export HTML to SVG or PNG

Export manually when requested. Keep the original HTML unchanged as the source of truth.

## SVG

1. Read the HTML and extract the first diagram `<svg>` block. If the file is a gallery with multiple SVGs, ask which diagram.
2. Ensure `xmlns="http://www.w3.org/2000/svg"` and a valid `viewBox`.
3. Preserve inline styles and add the font import only if the source relies on remote fonts.
4. Write a standalone `.svg` beside the HTML or to the explicit path.

Warn that offline Figma/Illustrator/importers may substitute remote fonts. Recommend PNG when exact appearance matters.

## PNG

Render the original HTML in a browser and screenshot only the SVG bounds, not the editorial wrapper. Use device scale 2 by default and 3 for print. If Playwright is not installed, tell the user how to install it and stop; do not install dependencies unprompted.

If an exact target size is requested, calculate `scale = target_width / viewBox_width`. Do not scale below 1 or above 4; redraw at a matching preset when the aspect ratio or scale is unreasonable.

## Do not

- hand-author a separate SVG that can drift from the HTML;
- modify the source to add export buttons or scripts;
- auto-export on every diagram generation;
- include headers/cards in a diagram-only SVG/PNG unless the user explicitly requests a full-page screenshot.
