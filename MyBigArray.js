
/**
 * Wrapper class over a two dimensional array, which mimics to be a one dimensional array.
 * (So we can have arrays longer than max array length.)
 */
class MyBigArray {
  constructor (options = { chunkSize: 10000000 }) {
    this.chunkSize = options.chunkSize
    this.mainArr = [[]]
    this.length = 0
  }

  push (e) {
    if (this.mainArr[this.mainArr.length - 1].length < this.chunkSize) {
      this.mainArr[this.mainArr.length - 1].push(e)
    } else {
      this.mainArr.push([e])
    }
    this.length++
  }

  get (i = 0) {
    const chunkNo = Math.floor(i / this.chunkSize)
    const indexInChunk = i - (chunkNo * this.chunkSize)
    return this.mainArr[chunkNo][indexInChunk]
  }
}

module.exports = { MyBigArray }
