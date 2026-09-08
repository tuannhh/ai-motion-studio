# Video readability and music balance

User requested larger diagrams, slightly louder background music and removal of the letterboxing visible when a landscape source image was placed inside a phone frame.

- Diagram boxes now size per row (up to 400px wide and 200px high), with hubs up to 240px, larger icons and labels. Existing canvas/safe areas remain the bounds.
- During narration, the music envelope retains 42% instead of 28% of the chosen music volume: a 1.5× amplitude increase (~3.5dB). Volume sliders, silence and fades remain effective.
- The pipeline measures actual screenshot source dimensions after copying/cropping. Real-image cards use that aspect ratio, up to the safe-area width and 940px image height, instead of forcing the selected device aspect. Full source content is preserved without stretching or cropping away text.

Regression coverage includes measured source aspect ratio. All 12 tests, TypeScript and web build passed before final visual review. Scripts 12 and 14 were resubmitted through the authorized API as jobs 19 and 20; prior exports are preserved.

Both jobs completed at 100%. Job 19 is 49.88s and job 20 is 76.46s. The latter's real source aspect is 1.80357, independent of its legacy `frame: phone` setting. Exported frame checks are `../qa/diagram-larger.jpg` and `../qa/source-image-fitted.jpg`; MP4 copies are `../ai-agent-so-do-lon-nhac-ro.mp4` and `../le-phi-anh-vua-khung.mp4`. Larger nodes remain within the diagram canvas; the landscape source fills its card without top/bottom letterboxing.
