# ARM and THUMB Instruction Simulator!

A simple ARMv7 CPU simulator written in Python. It parses and executes a subset of both ARM assembly instructions and THUMB instructions, showing CPU state step-by-step.

## Features

- Simulates registers, memory, and PC
- Executes basic ARMv7 instructions and Thumb instructions
- Parses `.txt` assembly files
- Prints state after each instruction

## Supported Instructions

- `MOV`, `ADD`, `SUB`, `MUL`
- `CMP`, `B`, `BEQ`, `BNE`
- `LDR`, `STR`
- `AND`, `ORR`, `EOR`

## How to Use

1. Navigate to index.html
2. Open index.html with live server
3. Click load sample in the instructions section
4. Navigate to the execution log and view CPU states

## Try It Out!
http://127.0.0.1:3000/src/index.html?serverWindowId=219731b0-e672-4d42-99fd-b8ee5af87512
