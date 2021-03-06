const fs = require('fs')
const { MyBigArray } = require('./MyBigArray')

const SQUARE_BRACKET_OPEN = new Uint8Array(Buffer.from('[', 'utf-8'))[0]
const SQUARE_BRACKET_CLOSE = new Uint8Array(Buffer.from(']', 'utf-8'))[0]
const SPACE = new Uint8Array(Buffer.from(' ', 'utf-8'))[0]
const COMMA = new Uint8Array(Buffer.from(',', 'utf-8'))[0]
const NEW_LINE = 10
const NUMBER = new Uint8Array(Buffer.from('0123456789.', 'utf-8'))

/**
 * Wrapper class over an array of buffers, which mimics to be one big buffer.
 * (To tackle the problem of max buffer size = 2GB)
 */
class MyBigBuffer {
  constructor (options = { chunkSize: 250000000 }) {
    this.chunkSize = options.chunkSize
    this.bufferArr = []
    this.uint8Arr = []
    this.length = 0
  }

  /**
   * Reads provided file into an array of buffers.
   * @param {String} geoJsonPath
   */
  load (geoJsonPath = '') {
    const size = fs.statSync(geoJsonPath).size
    const fd = fs.openSync(geoJsonPath, 'r')

    for (let i = 0; i < size; i += this.chunkSize) {
      const bufferSize = size - i < this.chunkSize ? size - i : this.chunkSize
      const chunk = Buffer.alloc(bufferSize)

      fs.readSync(fd, chunk, 0, bufferSize, i)

      this.bufferArr.push(chunk)
      this.uint8Arr.push(new Uint8Array(chunk))
      this.length += chunk.length
    }
  }

  /**
   * Returns byte (Uint8) at position i
   * @param {Number} i
   */
  get (i = 0) {
    const chunkNo = Math.floor(i / this.chunkSize)
    const indexInChunk = i - (chunkNo * this.chunkSize)

    return this.uint8Arr[chunkNo][indexInChunk]
  }

  /**
   * Checks if this big buffer contains the provided string,
   * at the provided position start.
   * @param {Uint8Array} stringUint8Array string in uint8 array
   * @param {Number} start start index in this big buffer
   */
  checkStringMatch (stringUint8Array, start) {
    if (stringUint8Array.length + start > this.length - 1) return false
    for (let i = start; i < start + stringUint8Array.length; i++) {
      if (this.get(i) !== stringUint8Array[i - start]) return false
    }
    return true
  }

  /**
   * finds occurrences of the provided chars/strings in byte format
   * @param {Array.Uint8Array} arr array of Uint8Array
   */
  findOccurrences (arr = [new Uint8Array(Buffer.from('{'))]) {
    const singleByteElements = arr.filter(e => e.length > 0 && e.length < 2).map(e => e[0])
    const multiByteElements = arr.filter(e => e.length > 1)

    const occurrences = []
    arr.forEach(() => { occurrences.push(new MyBigArray()) })

    /* eslint no-labels: ["error", { "allowLoop": true }] */
    bufferIteration:
    for (let i = 0; i < this.length; i++) {
      const chunkNo = Math.floor(i / this.chunkSize)
      const indexInChunk = i - (chunkNo * this.chunkSize)

      for (let j = 0; j < singleByteElements.length; j++) {
        if (singleByteElements[j] === this.uint8Arr[chunkNo][indexInChunk]) {
          occurrences[j].push(i)
          continue bufferIteration
        }
      }

      for (let j = 0; j < multiByteElements.length; j++) {
        if (multiByteElements[j][0] === this.uint8Arr[chunkNo][indexInChunk]) {
          if (this.checkStringMatch(multiByteElements[j], i)) {
            occurrences[j + singleByteElements.length].push(i)
            i += multiByteElements[j].length - 1
            continue bufferIteration
          }
        }
      }
    }

    return occurrences
  }

  /**
   * Returns the slice of the range defined by the provided indices in string format
   * @param {Number} start inclusive index
   * @param {Number} end inclusive index
   */
  sliceToString (start, end) {
    end += 1
    const startChunkNo = Math.floor(start / this.chunkSize)
    const startIndexInChunk = start - (startChunkNo * this.chunkSize)
    const endChunkNo = Math.floor(end / this.chunkSize)
    const endIndexInChunk = end - (endChunkNo * this.chunkSize)

    let string

    if (startChunkNo === endChunkNo) {
      // if start and end are in one an the same chunk

      string = this.bufferArr[startChunkNo].slice(startIndexInChunk, endIndexInChunk).toString()
    } else if (endChunkNo - startChunkNo === 1) {
      // if start and end are in two consecutively chunks

      const firstPart = this.bufferArr[startChunkNo].slice(startIndexInChunk)
      const lastPart = this.bufferArr[endChunkNo].slice(0, endIndexInChunk)
      string = Buffer.concat([firstPart, lastPart]).toString()
    } else {
      // if start and end span over more than two chunks

      const firstPart = this.bufferArr[startChunkNo].slice(startIndexInChunk)
      const lastPart = this.bufferArr[endChunkNo].slice(0, endIndexInChunk)

      const parts = [firstPart]
      for (let i = startChunkNo + 1; i < endChunkNo; i++) {
        parts.push(this.bufferArr[i].slice(0, this.chunkSize))
      }
      parts.push(lastPart)

      string = Buffer.concat(parts).toString()
    }

    return string
  }

  /**
   * Parses multiple slices of this buffer to one JSON.
   * @param {Array} arr [{ start: 0, end: 10}, { start: 15, end: 20}]
   */
  multiSlicesToJSON (arr) {
    let string = ''
    let json

    for (const elem of arr) {
      string += this.sliceToString(elem.start, elem.end)
    }

    try {
      json = JSON.parse(string)
    } catch (error) {
      console.error(`Failed to parse string to json: ${string}`)
      throw error
    }

    return json
  }

  /**
   * Returns the slice of the range defined by the provided indices in JSON format
   * @param {Number} start index inclusive
   * @param {Number} end index inclusive
   */
  sliceToJSON (start, end) {
    const string = this.sliceToString(start, end)
    let json

    try {
      json = JSON.parse(string)
    } catch (error) {
      console.error(`Failed to parse string to json: ${string}`)
      throw error
    }

    return json
  }

  /**
   * Parses an arbitrarily nested array of numbers iteratively from this buffer.
   * @param {Number} start index inclusive
   * @param {Number} end index inclusive
   */
  parseNumberArray (start, end) {
    let result
    const stack = []

    // iterate over all bytes of provided buffer range
    for (let i = start; i <= end; i++) {
      // get byte at position i
      const n = this.get(i)
      if (n === SPACE || n === NEW_LINE || n === COMMA) continue
      else if (n === SQUARE_BRACKET_OPEN) {
        // if byte is square bracket open: add new array to stack
        stack.push([])
      } else if (n === SQUARE_BRACKET_CLOSE) {
        /*
        if byte is close square bracket: pop last array from stack:
          if there are still elements in the stack: add the popped array into the last array on the stack
          if the stack is empty: it has to be the end of the most outer array: set result variable
        */
        const lastElem = stack.pop()
        if (stack.length > 0) {
          stack[stack.length - 1].push(lastElem)
        } else if (stack.length === 0 && i === end) {
          result = lastElem
        } else {
          throw new Error('Unexpected array closing.')
        }
      } else if (NUMBER.includes(n)) {
        // find start and end index of number in buffer
        let endIndex = i
        while (endIndex <= end && NUMBER.includes(this.get(endIndex))) endIndex++
        // revert last iteration of while
        endIndex--
        // parse number from string from buffer slice
        const num = Number(this.sliceToString(i, endIndex))

        // there has to be an array on the stack, which contains the just parsed number
        if (stack.length > 0) {
          stack[stack.length - 1].push(num)
        } else {
          throw new Error('Found number at unexpected position in array.')
        }

        // move i to end of number
        i = endIndex
      } else {
        throw new Error(`Found unexpected byte in number array: ${n}`)
      }
    }

    return result
  }
}

module.exports = { MyBigBuffer }
