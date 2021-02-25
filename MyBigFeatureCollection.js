const { MyBigBuffer } = require('./MyBigBuffer')

// get representation for certain chars in byte format
const CURVED_BRACKET_OPEN = new Uint8Array(Buffer.from('{', 'utf-8'))
const CURVED_BRACKET_CLOSE = new Uint8Array(Buffer.from('}', 'utf-8'))
const SQUARE_BRACKET_OPEN = new Uint8Array(Buffer.from('[', 'utf-8'))
const SQUARE_BRACKET_CLOSE = new Uint8Array(Buffer.from(']', 'utf-8'))
const FEATURE_STRING = new Uint8Array(Buffer.from('Feature"', 'utf-8'))

const toFind = [
  CURVED_BRACKET_OPEN,
  CURVED_BRACKET_CLOSE,
  SQUARE_BRACKET_OPEN,
  SQUARE_BRACKET_CLOSE,
  FEATURE_STRING
]

class MyBigFeatureCollection {
  /**
   * @param {Number} options.maxDirectJsonParseByteCount How long a feature can be in bytes so that it is parsed directly to json.
   * @param {Number} options.bufferChunkSize In how big chunks the geojson file should be read.
   */
  constructor (options = { maxDirectJsonParseByteCount: 250000000, bufferChunkSize: 250000000 }) {
    this.bigBuffer = new MyBigBuffer({ chunkSize: options.bufferChunkSize })
    this.features = []
    this.maxDirectJsonParseByteCount = options.maxDirectJsonParseByteCount
  }

  loadGeoJsonFile (file) {
    return new Promise((resolve, reject) => {
      // load file into chunks of Buffer objects
      this.bigBuffer.load(file).then(() => {
        console.time('find occurrences')
        // find occurrences of specific chars / words
        const occ = this.bigBuffer.findOccurrences(toFind)
        console.timeEnd('find occurrences')

        console.time('interpret occurrences')
        // array of indices of '{' char
        const curvedBracketsOpen = occ[0]
        // array of indices of '}' char
        const curvedBracketsClose = occ[1]
        // array of indices of '[' char
        const squareBracketOpen = occ[2]
        // array of indices of ']' char
        const squareBracketClose = occ[3]
        // array of starting indices of string: 'Feature"'
        const feature = occ[4]

        // simple stack to keep track of opened objects/arrays
        const stack = []

        // array to save starting and end indices of all features in the bigBuffer
        this.features = []

        // control variables to save current position of every index-array
        let curvedBracketsOpenIndex = 0
        let curvedBracketsCloseIndex = 0
        let squareBracketOpenIndex = 0
        let squareBracketCloseIndex = 0
        let featureIndex = 0

        /*
        While there are still unviewd Objects/Arrays
        */
        while (curvedBracketsOpenIndex < curvedBracketsOpen.length ||
          curvedBracketsCloseIndex < curvedBracketsClose.length ||
          squareBracketOpenIndex < squareBracketOpen.length ||
          squareBracketCloseIndex < squareBracketClose.length) {
          /*
          Find the next nearest index of char,
          from our bucket of chars. ('{', '}', '[')
          */
          const min = Math.min(curvedBracketsOpen.get(curvedBracketsOpenIndex) ?? Infinity,
            curvedBracketsClose.get(curvedBracketsCloseIndex) ?? Infinity,
            squareBracketOpen.get(squareBracketOpenIndex) ?? Infinity,
            squareBracketClose.get(squareBracketCloseIndex) ?? Infinity,
            feature.get(featureIndex) ?? Infinity)

          if (curvedBracketsOpen.get(curvedBracketsOpenIndex) === min) {
            // if the next char is a open curved bracket

            curvedBracketsOpenIndex++
            stack.push({ char: '{', index: min })
          } else if (curvedBracketsClose.get(curvedBracketsCloseIndex) === min) {
            // if the next char is a close curved bracket

            if (stack.length > 0 && stack[stack.length - 1].char === '{') {
              curvedBracketsCloseIndex++

              const isFeature = !!stack[stack.length - 1].isFeature
              const coordinates = stack[stack.length - 1].coordinates

              const start = stack.pop().index

              if (isFeature) {
                this.features.push({ start: start, end: min, coordinates: { start: coordinates[0], end: coordinates[1] } })
              }
            } else {
              reject(new Error('Unexpectd "}" character'))
              return
            }
          } else if (squareBracketOpen.get(squareBracketOpenIndex) === min) {
            // if the next char is a open square bracket

            if (stack.length > 0 && stack[stack.length - 1].char === '[') {
              squareBracketOpenIndex++
              squareBracketCloseIndex++
            } else {
              stack.push({ char: '[', index: min })
              squareBracketOpenIndex++
            }
          } else if (squareBracketClose.get(squareBracketCloseIndex) === min) {
            // if the next char is a close square bracket

            if (stack.length > 0 && stack[stack.length - 1].char === '[') {
              squareBracketCloseIndex++
              const start = stack.pop().index
              for (let i = stack.length - 1; i > -1; i--) {
                if (stack[i].isFeature) {
                  stack[i].coordinates = [start, min]
                  break
                }
              }
            } else {
              console.log(stack)
              reject(new Error('Unexpectd "]" character'))
              return
            }
          } else if (feature.get(featureIndex) === min) {
            // if the next char sequence is 'Feature"'

            if (stack.length > 0 && stack[stack.length - 1].char === '{') {
              featureIndex++
              stack[stack.length - 1].isFeature = true
            } else {
              reject(new Error('Unexpected type: Feature property'))
              return
            }
          } else {
            reject(new Error('Invalid Tree. Unexpected JSON control sequence.'))
            return
          }
        }
        console.timeEnd('interpret occurrences')

        resolve()
      }).catch(err => {
        reject(err)
      })
    })
  }

  /**
   * Parses the individual features of the FeatureCollection and yields them one by one.
   *
   * If the byte count of one feature is less than "maxDirectJsonParseByteCount" it directly converts
   * the byte range to a string and parses it to a json object.
   * Otherwise it parses the feature without the coordinates array and parses the coordinates separately and iteratively.
   * Then adds the seperately parsed coordinates array to the feature object.
   */
  * getFeatures () {
    if (this.features.length < 1) throw new Error('No geojson file was loaded!')

    // iterate over start/end indices of features
    for (const featureIndices of this.features) {
      const byteCount = featureIndices.end - featureIndices.start

      if (byteCount < this.maxDirectJsonParseByteCount) {
        const json = this.bigBuffer.sliceToJSON(featureIndices.start, featureIndices.end)
        yield json
      } else {
        const arr = [
          { start: featureIndices.start, end: featureIndices.coordinates.start },
          { start: featureIndices.coordinates.end, end: featureIndices.end }
        ]

        // parse feature without coordinates array to json
        const json = this.bigBuffer.multiSlicesToJSON(arr)

        console.time('coordinates read')
        // parse coordinates array iteratively
        const coordinates = this.bigBuffer.parseNumberArray(featureIndices.coordinates.start, featureIndices.coordinates.end)
        console.timeEnd('coordinates read')

        json.geometry.coordinates = coordinates

        yield json
      }
    }
  }
}

module.exports = {
  MyBigFeatureCollection
}
