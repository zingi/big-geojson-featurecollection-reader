const { MyBigFeatureCollection } = require('./MyBigFeatureCollection')

const file = './test/data/features.json'

const bigFeatureCollection = new MyBigFeatureCollection()

bigFeatureCollection.loadGeoJsonFile(file)
for (const feature of bigFeatureCollection.getFeatures()) {
  /*
  Do something with feature
  */
  console.log(feature)
}
