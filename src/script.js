class CPUState {
  constructor() {
    this.registers = new Array(16).fill(0)
    this.pc = 0
    this.memory = new Uint8Array(65536)
    this.flags = { Z: 0, N: 0, C: 0, V: 0 }
    this.changedRegisters = new Set()
    this.changedFlags = new Set()
  }

  reset() {
    this.registers.fill(0)
    this.pc = 0
    this.memory.fill(0)
    this.flags = { Z: 0, N: 0, C: 0, V: 0 }
    this.changedRegisters.clear()
    this.changedFlags.clear()
  }

  setRegister(reg, value, trackChange = true) {
    if (trackChange && this.registers[reg] !== value) {
      this.changedRegisters.add(reg)
    }
    this.registers[reg] = value & 0xffffffff // Keep 32-bit
  }

  setFlag(flag, value, trackChange = true) {
    if (trackChange && this.flags[flag] !== value) {
      this.changedFlags.add(flag)
    }
    this.flags[flag] = value
  }

  clearChangeTracking() {
    this.changedRegisters.clear()
    this.changedFlags.clear()
  }
}

class ARMSimulator {
  constructor() {
    this.cpu = new CPUState()
    this.instructions = []
    this.currentInstructionIndex = 0
    this.cycleCount = 0
    this.isRunning = false
    this.executionLog = []

    this.initializeUI()
    this.updateDisplay()
  }

  initializeUI() {
    // Button event listeners
    document.getElementById("loadInstructions").addEventListener("click", () => this.loadInstructions())
    document.getElementById("loadSample").addEventListener("click", () => this.loadSampleInstructions())
    document.getElementById("clearInstructions").addEventListener("click", () => this.clearInstructions())
    document.getElementById("resetBtn").addEventListener("click", () => this.reset())
    document.getElementById("stepBtn").addEventListener("click", () => this.step())
    document.getElementById("runBtn").addEventListener("click", () => this.runAll())
    document.getElementById("pauseBtn").addEventListener("click", () => this.pause())
    document.getElementById("clearLog").addEventListener("click", () => this.clearLog())
    document.getElementById("refreshMemory").addEventListener("click", () => this.updateMemoryDisplay())
  }

  parseInstruction(line) {
    line = line.trim().toUpperCase()
    if (!line || line.startsWith(";")) return null

    const parts = line.split(/[\s,]+/).filter((part) => part)
    if (parts.length === 0) return null

    const op = parts[0]
    const instruction = { op, size: 4 }

    // Parse different instruction formats
    switch (op) {
      case "MOV":
      case "MOVS":
        instruction.rd = this.parseRegister(parts[1])
        if (parts[2].startsWith("#")) {
          instruction.imm = this.parseImmediate(parts[2])
        } else {
          instruction.rm = this.parseRegister(parts[2])
        }
        break

      case "ADD":
      case "ADDS":
      case "SUB":
      case "SUBS":
      case "AND":
      case "ORR":
      case "EOR":
        instruction.rd = this.parseRegister(parts[1])
        instruction.rn = this.parseRegister(parts[2])
        if (parts[3].startsWith("#")) {
          instruction.imm = this.parseImmediate(parts[3])
        } else {
          instruction.rm = this.parseRegister(parts[3])
        }
        break

      case "CMP":
        instruction.rn = this.parseRegister(parts[1])
        if (parts[2].startsWith("#")) {
          instruction.imm = this.parseImmediate(parts[2])
        } else {
          instruction.rm = this.parseRegister(parts[2])
        }
        break

      case "LDR":
      case "STR":
        instruction.rd = this.parseRegister(parts[1])
        // Parse [Rn, #offset] format
        const memPart = parts.slice(2).join("").replace(/[[\]]/g, "")
        const memParts = memPart.split(",")
        instruction.rn = this.parseRegister(memParts[0])
        if (memParts[1]) {
          instruction.imm = this.parseImmediate(memParts[1])
        } else {
          instruction.imm = 0
        }
        break

      case "B":
      case "BL":
        instruction.offset = this.parseImmediate(parts[1]) || 4 // Default offset
        break

      case "BX":
        instruction.rm = this.parseRegister(parts[1])
        break

      default:
        return null
    }

    return instruction
  }

  parseRegister(reg) {
    if (reg.startsWith("R")) {
      return Number.parseInt(reg.substring(1))
    }
    return 0
  }

  parseImmediate(imm) {
    if (imm.startsWith("#")) {
      const value = imm.substring(1)
      if (value.startsWith("0x") || value.startsWith("0X")) {
        return Number.parseInt(value, 16)
      }
      return Number.parseInt(value)
    }
    return Number.parseInt(imm)
  }

  loadInstructions() {
    const input = document.getElementById("instructionInput").value
    const lines = input.split("\n")

    this.instructions = []
    lines.forEach((line, index) => {
      const instruction = this.parseInstruction(line)
      if (instruction) {
        instruction.originalLine = line.trim()
        instruction.lineNumber = index + 1
        this.instructions.push(instruction)
      }
    })

    this.reset()
    this.updateInstructionDisplay()
    this.log(`Loaded ${this.instructions.length} instructions`)
  }

  loadSampleInstructions() {
    const sample = `MOV R0, #4
ADD R1, R0, #2
SUB R2, R1, R0
CMP R0, #4
AND R3, R1, #15
ORR R4, R3, #240
STR R1, [R0, #0]
LDR R5, [R0, #0]`

    document.getElementById("instructionInput").value = sample
    this.loadInstructions()
  }

  clearInstructions() {
    document.getElementById("instructionInput").value = ""
    this.instructions = []
    this.reset()
    this.updateInstructionDisplay()
  }

  reset() {
    this.cpu.reset()
    this.currentInstructionIndex = 0
    this.cycleCount = 0
    this.isRunning = false
    this.clearLog()
    this.updateDisplay()
    this.log("Simulator reset")
  }

  step() {
    if (this.currentInstructionIndex >= this.instructions.length) {
      this.log("No more instructions to execute")
      return
    }

    const instruction = this.instructions[this.currentInstructionIndex]
    this.cpu.clearChangeTracking()

    this.log(`Cycle ${this.cycleCount}: Executing ${instruction.originalLine}`)
    this.executeInstruction(instruction)

    this.cycleCount++
    this.currentInstructionIndex++
    this.updateDisplay()
  }

  async runAll() {
    this.isRunning = true
    document.getElementById("runBtn").disabled = true
    document.getElementById("pauseBtn").disabled = false

    while (this.isRunning && this.currentInstructionIndex < this.instructions.length) {
      this.step()
      await new Promise((resolve) => setTimeout(resolve, 500)) // 500ms delay
    }

    this.isRunning = false
    document.getElementById("runBtn").disabled = false
    document.getElementById("pauseBtn").disabled = true

    if (this.currentInstructionIndex >= this.instructions.length) {
      this.log("Program execution completed")
    }
  }

  pause() {
    this.isRunning = false
    document.getElementById("runBtn").disabled = false
    document.getElementById("pauseBtn").disabled = true
    this.log("Execution paused")
  }

  executeInstruction(instruction) {
    const op = instruction.op

    switch (op) {
      case "MOV":
        this.instrMov(instruction)
        break
      case "MOVS":
        this.instrMovs(instruction)
        break
      case "ADD":
        this.instrAdd(instruction)
        break
      case "ADDS":
        this.instrAdds(instruction)
        break
      case "SUB":
        this.instrSub(instruction)
        break
      case "SUBS":
        this.instrSubs(instruction)
        break
      case "CMP":
        this.instrCmp(instruction)
        break
      case "AND":
        this.instrAnd(instruction)
        break
      case "ORR":
        this.instrOrr(instruction)
        break
      case "EOR":
        this.instrEor(instruction)
        break
      case "LDR":
        this.instrLdr(instruction)
        break
      case "STR":
        this.instrStr(instruction)
        break
      case "B":
        this.instrB(instruction)
        break
      case "BL":
        this.instrBl(instruction)
        break
      case "BX":
        this.instrBx(instruction)
        break
      default:
        this.log(`Unknown operation: ${op}`)
    }

    // Log register and flag changes
    this.cpu.changedRegisters.forEach((reg) => {
      this.log(`  R${reg} = ${this.cpu.registers[reg]}`, "register-change")
    })

    this.cpu.changedFlags.forEach((flag) => {
      this.log(`  ${flag} = ${this.cpu.flags[flag]}`, "flag-change")
    })
  }

  // Instruction implementations
  instrMov(instruction) {
    const value = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, value)
    this.cpu.pc += instruction.size
  }

  instrMovs(instruction) {
    const value = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, value)
    this.cpu.setFlag("Z", value === 0 ? 1 : 0)
    this.cpu.setFlag("N", value < 0 ? 1 : 0)
    this.cpu.pc += instruction.size
  }

  instrAdd(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, val1 + val2)
    this.cpu.pc += instruction.size
  }

  instrAdds(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    const result = val1 + val2

    this.cpu.setRegister(instruction.rd, result)
    this.cpu.setFlag("Z", result === 0 ? 1 : 0)
    this.cpu.setFlag("N", result < 0 ? 1 : 0)
    this.cpu.setFlag("C", val1 + val2 > 0xffffffff ? 1 : 0)
    this.cpu.setFlag("V", ((val1 ^ result) & (val2 ^ result)) >> 31 ? 1 : 0)
    this.cpu.pc += instruction.size
  }

  instrSub(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, val1 - val2)
    this.cpu.pc += instruction.size
  }

  instrSubs(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    const result = val1 - val2

    this.cpu.setRegister(instruction.rd, result)
    this.cpu.setFlag("Z", result === 0 ? 1 : 0)
    this.cpu.setFlag("N", result < 0 ? 1 : 0)
    this.cpu.setFlag("C", val1 >= val2 ? 1 : 0)
    this.cpu.setFlag("V", ((val1 ^ val2) & (val1 ^ result)) >> 31 ? 1 : 0)
    this.cpu.pc += instruction.size
  }

  instrCmp(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    const result = val1 - val2

    this.cpu.setFlag("Z", result === 0 ? 1 : 0)
    this.cpu.setFlag("N", result < 0 ? 1 : 0)
    this.cpu.setFlag("C", val1 >= val2 ? 1 : 0)
    this.cpu.setFlag("V", ((val1 ^ val2) & (val1 ^ result)) >> 31 ? 1 : 0)
    this.cpu.pc += instruction.size
  }

  instrAnd(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, val1 & val2)
    this.cpu.pc += instruction.size
  }

  instrOrr(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, val1 | val2)
    this.cpu.pc += instruction.size
  }

  instrEor(instruction) {
    const val1 = this.cpu.registers[instruction.rn]
    const val2 = instruction.imm !== undefined ? instruction.imm : this.cpu.registers[instruction.rm]
    this.cpu.setRegister(instruction.rd, val1 ^ val2)
    this.cpu.pc += instruction.size
  }

  instrLdr(instruction) {
    const addr = this.cpu.registers[instruction.rn] + (instruction.imm || 0)
    if (addr + 3 < this.cpu.memory.length) {
      const val =
        this.cpu.memory[addr] |
        (this.cpu.memory[addr + 1] << 8) |
        (this.cpu.memory[addr + 2] << 16) |
        (this.cpu.memory[addr + 3] << 24)
      this.cpu.setRegister(instruction.rd, val)
    }
    this.cpu.pc += instruction.size
  }

  instrStr(instruction) {
    const addr = this.cpu.registers[instruction.rn] + (instruction.imm || 0)
    const val = this.cpu.registers[instruction.rd]
    if (addr + 3 < this.cpu.memory.length) {
      this.cpu.memory[addr] = val & 0xff
      this.cpu.memory[addr + 1] = (val >> 8) & 0xff
      this.cpu.memory[addr + 2] = (val >> 16) & 0xff
      this.cpu.memory[addr + 3] = (val >> 24) & 0xff
    }
    this.cpu.pc += instruction.size
  }

  instrB(instruction) {
    this.cpu.pc += instruction.offset
  }

  instrBl(instruction) {
    this.cpu.setRegister(14, this.cpu.pc + 4) // Save return address in LR
    this.cpu.pc += instruction.offset
  }

  instrBx(instruction) {
    this.cpu.pc = this.cpu.registers[instruction.rm]
  }

  // UI Update methods
  updateDisplay() {
    this.updateRegisterDisplay()
    this.updateFlagDisplay()
    this.updatePCDisplay()
    this.updateCycleDisplay()
    this.updateCurrentInstructionDisplay()
    this.updateInstructionDisplay()
    this.updateMemoryDisplay()
  }

  updateRegisterDisplay() {
    const grid = document.getElementById("registerGrid")
    grid.innerHTML = ""

    for (let i = 0; i < 16; i++) {
      const regDiv = document.createElement("div")
      regDiv.className = "register"
      if (this.cpu.changedRegisters.has(i)) {
        regDiv.classList.add("changed")
      }

      regDiv.innerHTML = `
                <div class="register-label">R${i}</div>
                <div class="register-value">${this.cpu.registers[i]}</div>
            `
      grid.appendChild(regDiv)
    }
  }

  updateFlagDisplay() {
    ;["Z", "N", "C", "V"].forEach((flag) => {
      const flagElement = document.getElementById(`flag${flag}`)
      flagElement.querySelector("span").textContent = this.cpu.flags[flag]

      if (this.cpu.flags[flag] === 1) {
        flagElement.classList.add("set")
      } else {
        flagElement.classList.remove("set")
      }
    })
  }

  updatePCDisplay() {
    document.getElementById("pcValue").textContent = this.cpu.pc
  }

  updateCycleDisplay() {
    document.getElementById("cycleCount").textContent = this.cycleCount
  }

  updateCurrentInstructionDisplay() {
    const display = document.getElementById("currentInstr")
    if (this.currentInstructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.currentInstructionIndex]
      display.innerHTML = `<strong>Line ${instruction.lineNumber}:</strong> ${instruction.originalLine}`
    } else {
      display.innerHTML = '<p class="empty-state">No more instructions</p>'
    }
  }

  updateInstructionDisplay() {
    const display = document.getElementById("instructionDisplay")

    if (this.instructions.length === 0) {
      display.innerHTML = '<p class="empty-state">No instructions loaded</p>'
      return
    }

    display.innerHTML = ""
    this.instructions.forEach((instruction, index) => {
      const instrDiv = document.createElement("div")
      instrDiv.className = "instruction-item"

      if (index === this.currentInstructionIndex) {
        instrDiv.classList.add("current")
      } else if (index < this.currentInstructionIndex) {
        instrDiv.classList.add("executed")
      }

      instrDiv.innerHTML = `<strong>${index}:</strong> ${instruction.originalLine}`
      display.appendChild(instrDiv)
    })
  }

  updateMemoryDisplay() {
    const display = document.getElementById("memoryDisplay")
    const startAddr = Number.parseInt(document.getElementById("memoryStart").value) || 0

    display.innerHTML = ""

    for (let addr = startAddr; addr < Math.min(startAddr + 256, this.cpu.memory.length); addr += 16) {
      const rowDiv = document.createElement("div")
      rowDiv.className = "memory-row"

      const addrDiv = document.createElement("div")
      addrDiv.className = "memory-address"
      addrDiv.textContent = `0x${addr.toString(16).padStart(4, "0")}:`

      const valuesDiv = document.createElement("div")
      valuesDiv.className = "memory-values"

      for (let i = 0; i < 16 && addr + i < this.cpu.memory.length; i++) {
        const byteDiv = document.createElement("div")
        byteDiv.className = "memory-byte"
        const value = this.cpu.memory[addr + i]
        byteDiv.textContent = value.toString(16).padStart(2, "0")

        if (value !== 0) {
          byteDiv.classList.add("changed")
        }

        valuesDiv.appendChild(byteDiv)
      }

      rowDiv.appendChild(addrDiv)
      rowDiv.appendChild(valuesDiv)
      display.appendChild(rowDiv)
    }
  }

  log(message, type = "info") {
    const logDiv = document.getElementById("executionLog")
    const entry = document.createElement("div")
    entry.className = `log-entry ${type}`
    entry.textContent = message

    logDiv.appendChild(entry)
    logDiv.scrollTop = logDiv.scrollHeight

    this.executionLog.push({ message, type, timestamp: Date.now() })
  }

  clearLog() {
    document.getElementById("executionLog").innerHTML = '<p class="empty-state">Execution log will appear here</p>'
    this.executionLog = []
  }
}

// Initialize the simulator when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.simulator = new ARMSimulator()
})
