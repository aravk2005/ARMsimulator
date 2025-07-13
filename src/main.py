from simulator import CPUState, run_simulator, print_state
from decoding import get_instruction_list

def main():
    # Load and decode binary file
    filename = "test_mixed_fixedd.bin"
    instruction = get_instruction_list(filename)

    # Print decoded instruction summary
    print("=== Decoded Instructions ===")
    for idx, instr in enumerate(instruction):
        print(f"{idx}: {instr}")
    print("============================\n")

    # Initialize CPU state and run simulation
    cpu = CPUState()
    run_simulator(instruction, cpu)

    print("=== Final CPU State ===")
    print_state(cpu)

if __name__ == "__main__":
    main()
