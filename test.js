const fs = require('fs')
const test = require('ava')
const { MyBigFeatureCollection } = require('./MyBigFeatureCollection')

const file = './test/data/features.json'

test('feature content', async t => {
  const content = await fs.promises.readFile(file, { encoding: 'utf8' })
  const json = JSON.parse(content)

  /*
  maxDirectJsonParseByteCount: 1
  => trigger iteratively parsing of coordinates array for every feature
  */
  const bigFeatureCollection = new MyBigFeatureCollection({ maxDirectJsonParseByteCount: 1, bufferChunkSize: 250000000 })

  // load geojson file into a chunked buffer array
  await bigFeatureCollection.loadGeoJsonFile(file)

  // parse features from buffer
  const parsedFeatures = [...bigFeatureCollection.getFeatures()]

  // check number of features
  t.is(json.features.length, parsedFeatures.length)

  // check feature content
  parsedFeatures.forEach((feature, i) => {
    t.is(JSON.stringify(json.features[i]), JSON.stringify(feature))
  })
})

test('for of', async t => {
  const json = JSON.parse(await fs.promises.readFile(file, { encoding: 'utf8' }))
  const bigFeatureCollection = new MyBigFeatureCollection()
  await bigFeatureCollection.loadGeoJsonFile(file)

  let i = 0
  // test for..of syntax
  for (const feature of bigFeatureCollection.getFeatures()) {
    t.is(JSON.stringify(json.features[i++]), JSON.stringify(feature))
  }
})

test('iterator', async t => {
  const json = JSON.parse(await fs.promises.readFile(file, { encoding: 'utf8' }))
  const bigFeatureCollection = new MyBigFeatureCollection()
  await bigFeatureCollection.loadGeoJsonFile(file)

  const iter = bigFeatureCollection.getFeatures()

  let i = 0
  // test iterator syntax
  while (true) {
    const next = iter.next()
    if (next.done) break
    const feature = next.value

    t.is(JSON.stringify(json.features[i++]), JSON.stringify(feature))
  }
})
