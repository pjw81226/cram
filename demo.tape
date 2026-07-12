# cram demo tape — render with:  vhs demo.tape   (run from the repo root)
# Produces assets/demo.gif. Requires: vhs (brew install vhs) and a build (npm run build).

Output assets/demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 1180
Set Height 760
Set Padding 22
Set Theme "Dracula"
Set TypingSpeed 55ms

# Make `cram` resolve to the local build without a global install.
Hide
Type 'alias cram="node dist/cli.js"'
Enter
Ctrl+L
Show

# 1. Launch the interactive packer with a snug budget — it auto-fits on open.
Type "cram --budget 30k"
Sleep 500ms
Enter
Sleep 2.5s

# 2. Shrink the budget below what's selected — the gauge turns red (OVER).
Type "["
Sleep 1.5s
Type "["
Sleep 2s

# 3. The money shot: auto-fit drops the least-important files and snaps green.
Type "a"
Sleep 3s

# 4. Walk the tree and toggle a file back in — the gauge reacts live.
Type "jjj"
Sleep 500ms
Type " "
Sleep 1.5s

# 5. Give it more room again — budget climbs, headroom opens up.
Type "]]"
Sleep 1.8s

# 6. Cycle the output format (Markdown → XML → plain).
Type "f"
Sleep 1.3s

# 7. Copy the bundle to the clipboard.
Type "c"
Sleep 1.8s

# 8. Quit back to the shell.
Type "q"
Sleep 800ms

# 9. Same engine, headless — fit a repo to 100k tokens in one command.
Type "cram . --budget 100k -o context.md"
Sleep 700ms
Enter
Sleep 2.5s
