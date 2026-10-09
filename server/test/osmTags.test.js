import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, accessOf, parseFee, amenitiesOf, mapElement } from '../src/lib/osmTags.js';

const region = { country: 'Kenya', fallbackArea: 'Greater Nairobi' };
const node = (tags, extra = {}) => ({ type: 'node', id: 1, lat: -1.3, lon: 36.8, tags, ...extra });

test('categories', () => {
  assert.equal(categoryOf({ amenity: 'toilets' }), 'toilet');
  assert.equal(categoryOf({ amenity: 'drinking_water' }), 'water');
  assert.equal(categoryOf({ man_made: 'water_well' }), 'water');
  assert.equal(categoryOf({ amenity: 'waste_disposal' }), 'waste');
  assert.equal(categoryOf({ amenity: 'pharmacy' }), 'health');
  assert.equal(categoryOf({ amenity: 'waste_basket' }), null); // single bins are not imported
  assert.equal(categoryOf({ amenity: 'restaurant' }), null);
});

test('access: private is dropped, customers-only is flagged, default is public', () => {
  assert.equal(accessOf({}), 'public');
  assert.equal(accessOf({ access: 'yes' }), 'public');
  assert.equal(accessOf({ access: 'permissive' }), 'public');
  assert.equal(accessOf({ access: 'customers' }), 'customers');
  assert.equal(accessOf({ access: 'private' }), 'private');
  assert.equal(accessOf({ access: 'no' }), 'private');
  assert.deepEqual(mapElement(node({ amenity: 'toilets', access: 'private' }), region), { skip: 'private-access' });
  assert.equal(mapElement(node({ amenity: 'toilets', access: 'customers' }), region).access, 'customers');
});

test('fee: only what is stated; unknown stays null', () => {
  assert.equal(parseFee({ fee: 'no' }), 0);
  assert.equal(parseFee({ fee: 'yes', charge: 'KES 10' }), 10);
  assert.equal(parseFee({ fee: 'yes', charge: '20 KES' }), 20);
  assert.equal(parseFee({ charge: 'UGX 1,500' }), 1500);
  assert.equal(parseFee({ fee: 'yes' }), null);
  assert.equal(parseFee({}), null);
});

test('amenities come from tags or are null — never invented', () => {
  assert.equal(amenitiesOf({}), null);
  assert.deepEqual(amenitiesOf({ wheelchair: 'yes', lit: 'yes' }), ['Disability access', 'Lighting']);
  assert.deepEqual(amenitiesOf({ 'toilets:handwashing': 'yes' }), ['Handwashing']);
});

test('mapElement: ids, centre of ways, generic names, disused skipped, nothing fabricated', () => {
  const way = mapElement({ type: 'way', id: 77, center: { lat: 0.31, lon: 32.58 }, tags: { amenity: 'toilets' } }, { country: 'Uganda', fallbackArea: 'Greater Kampala' });
  assert.equal(way.id, 'osm-way-77');
  assert.equal(way.lat, 0.31);
  assert.equal(way.name, 'Public toilet');
  assert.equal(way.named, false);
  assert.equal(way.fee, null);
  assert.equal(way.amenities, null);
  assert.equal(way.hours, null);
  assert.equal(way.area, 'Greater Kampala');
  assert.deepEqual(mapElement(node({ amenity: 'toilets', disused: 'yes' }), region), { skip: 'disused' });
  assert.deepEqual(mapElement({ type: 'node', id: 2, tags: { amenity: 'toilets' } }, region), { skip: 'no-coordinates' });
  const named = mapElement(node({ amenity: 'toilets', name: 'Kibera DC', opening_hours: '06:00-20:00', fee: 'no', operator: 'Nairobi County' }), region);
  assert.equal(named.name, 'Kibera DC');
  assert.equal(named.named, true);
  assert.equal(named.hours, '06:00-20:00');
  assert.equal(named.fee, 0);
  assert.match(named.description, /Operated by Nairobi County/);
});
