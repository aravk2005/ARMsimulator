import struct

def write_bin(filename):
    instructions = []

    # --- ARM instructions (little-endian 32-bit) ---
    instructions += [
        0xE3A00004,  # MOV R0, #4
        0xE0810002,  # ADD R0,R1,R2
        0xE0410002,  # SUB R0,R1,R2
        0xE3500004,  # CMP R0, #4
        0xE2010004,  # AND R0, R1, #4
        0xE3810004,  # ORR R0, R1, #4
        0xE2210004,  # EOR R0, R1, #4
        0xE5910000,  # LDR R0, [R1, #0]
        0xE5810004,  # STR R0, [R1, #4]
        0xEAFFFFFE,  # B Label  Label: ADD R0,R1,R2(relative)
        0xEBFFFFFE ,  # BL Label Label: ADD R0,R1,R2 (relative)
        0xE12FFF11,  # BX R1
    ]

    # --- Thumb instructions (little-endian 16-bit) ---
    thumb_instrs = [
        0x2304,  # MOV R0, #0
        0x1860,  # ADD R0, R1, R2 (encodes as Rd=1, Rs=1, #1)
        0x1A50,  # SUB R0, R1, R2 (encodes as Rd=2, Rs=1, #2)
    ]

    with open(filename, 'wb') as f:
        for instr in instructions:
            f.write(struct.pack('<I', instr))
        for tinstr in thumb_instrs:
            f.write(struct.pack('<H', tinstr))

write_bin("test_mixed_fixedd.bin")
