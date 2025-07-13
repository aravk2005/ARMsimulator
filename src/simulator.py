class CPUState():
    def __init__(self):
        self.registers = [0] * 16
        self.pc = 0
        self.memory = bytearray(65536)
        self.flags = {"Z": 0, "N": 0, "C": 0, "V": 0}


def instr_add(instruction, state):
    val1 = state.registers[instruction["rn"]]
    val2 = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.registers[instruction["rd"]] = val1 + val2
    state.pc += instruction["size"]


def instr_adds(instruction, state):
    val1 = state.registers[instruction["rn"]]
    val2 = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    result = val1 + val2
    state.registers[instruction["rd"]] = result
    state.flags["Z"] = int(result == 0)
    state.flags["N"] = int(result < 0)
    # Carry flag set if unsigned addition overflow (val1 + val2) >= 2**32
    state.flags["C"] = int((val1 + val2) > 0xFFFFFFFF)
    # Overflow flag for signed overflow detection
    state.flags["V"] = int(((val1 ^ result) & (val2 ^ result)) >> 31)
    state.pc += instruction["size"]


def instr_sub(instruction, state):
    val1 = state.registers[instruction["rn"]]
    val2 = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.registers[instruction["rd"]] = val1 - val2
    state.pc += instruction["size"]


def instr_subs(instruction, state):
    val1 = state.registers[instruction["rn"]]
    val2 = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    result = val1 - val2
    state.registers[instruction["rd"]] = result
    state.flags["Z"] = int(result == 0)
    state.flags["N"] = int(result < 0)
    # Carry flag set if no borrow: val1 >= val2
    state.flags["C"] = int(val1 >= val2)
    # Overflow flag for signed overflow detection
    state.flags["V"] = int(((val1 ^ val2) & (val1 ^ result)) >> 31)
    state.pc += instruction["size"]


def instr_mov(instruction, state):
    value = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.registers[instruction["rd"]] = value
    state.pc += instruction["size"]


def instr_movs(instruction, state):
    value = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.registers[instruction["rd"]] = value
    state.flags["Z"] = int(value == 0)
    state.flags["N"] = int(value < 0)
    state.pc += instruction["size"]


def instr_cmp(instruction, state):
    val1 = state.registers[instruction["rn"]]
    val2 = instruction.get("imm", state.registers[instruction.get("rm", 0)])
    result = val1 - val2
    state.flags["Z"] = int(result == 0)
    state.flags["N"] = int(result < 0)
    state.flags["C"] = int(val1 >= val2)
    state.flags["V"] = int(((val1 ^ val2) & (val1 ^ result)) >> 31)
    state.pc += instruction["size"]


def instr_and(instruction, state):
    state.registers[instruction["rd"]] = state.registers[instruction["rn"]] & instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.pc += instruction["size"]


def instr_orr(instruction, state):
    state.registers[instruction["rd"]] = state.registers[instruction["rn"]] | instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.pc += instruction["size"]


def instr_eor(instruction, state):
    state.registers[instruction["rd"]] = state.registers[instruction["rn"]] ^ instruction.get("imm", state.registers[instruction.get("rm", 0)])
    state.pc += instruction["size"]


def instr_ldr(instruction, state):
    addr = state.registers[instruction["rn"]] + instruction.get("imm", 0)
    val = int.from_bytes(state.memory[addr:addr+4], 'little')
    state.registers[instruction["rd"]] = val
    state.pc += instruction["size"]


def instr_str(instruction, state):
    addr = state.registers[instruction["rn"]] + instruction.get("imm", 0)
    val = state.registers[instruction["rd"]]
    state.memory[addr:addr+4] = val.to_bytes(4, 'little')
    state.pc += instruction["size"]


def instr_b(instruction, state):
    # Offset is in bytes and can be negative
    state.pc += instruction["offset"]


def instr_bl(instruction, state):
    # Save return address (next instruction after BL) in LR (R14)
    state.registers[14] = state.pc + 4
    state.pc += instruction["offset"]


def instr_bx(instruction, state):
    state.pc = state.registers[instruction["rm"]]


def execute(instruction, state):
    op = instruction["op"]

    if op == "ADD":
        instr_add(instruction, state)
    elif op == "ADDS":
        instr_adds(instruction, state)
    elif op == "SUB":
        instr_sub(instruction, state)
    elif op == "SUBS":
        instr_subs(instruction, state)
    elif op == "MOV":
        instr_mov(instruction, state)
    elif op == "MOVS":
        instr_movs(instruction, state)
    elif op == "CMP":
        instr_cmp(instruction, state)
    elif op == "AND":
        instr_and(instruction, state)
    elif op == "ORR":
        instr_orr(instruction, state)
    elif op == "EOR":
        instr_eor(instruction, state)
    elif op == "LDR":
        instr_ldr(instruction, state)
    elif op == "STR":
        instr_str(instruction, state)
    elif op == "B":
        instr_b(instruction, state)
    elif op == "BL":
        instr_bl(instruction, state)
    elif op == "BX":
        instr_bx(instruction, state)
    else:
        print("Operation unknown:", op)
        # Advance PC to avoid infinite loop on unknown op
        state.pc += instruction.get("size", 4)


def run_simulator(instruction, state, max_cycles=100):
    cycles = 0
    while cycles < max_cycles:
        # Map PC (byte offset) to instruction index respecting instruction sizes
        pc_bytes = state.pc
        pc_counter = 0
        instr_index = None
        for i, instr in enumerate(instruction):
            if pc_counter == pc_bytes:
                instr_index = i
                break
            pc_counter += instr["size"]

        if instr_index is None or instr_index >= len(instruction):
            print("PC out of instruction bounds. Halting.")
            break

        instr = instruction[instr_index]
        print(f"Cycle {cycles}: PC={state.pc}, Executing: {instr}")
        execute(instr, state)
        cycles += 1

    if cycles >= max_cycles:
        print(" Max cycle count reached; simulation halted.")


def print_state(state):
    print("=== CPU State ===")
    for i in range(16):
        print(f"R{i}: {state.registers[i]}")
    print(f"PC: {state.pc}")
    print("Flags:")
    for flag in ["Z", "N", "C", "V"]:
        print(f"{flag}= {state.flags[flag]}")
