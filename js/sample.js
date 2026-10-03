// Sample garden, loaded as its own demo site. Nothing in the app depends on it.

export const SAMPLE_SITE = {
  name: 'Derby walled kitchen garden',
  location: 'Derby, UK',
  last_frost: '05-10',
  first_frost: '10-20',
};

export const SAMPLE_BEDS = [
  ['greenhouse', ['GH Bed 1', 'GH Bed 2', 'GH Bed 3', 'GH Bed 4', 'Potting bench']],
  ['outdoor', ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Bed 5', 'Bed 6', 'Bed 7']],
  ['informal', ['Strawberry bed', 'Herb/perennial beds', 'Ornamental beds', 'Field kitchen']],
];

// [crop, variety, supplier]
export const SAMPLE_VARIETIES = [
  ['Pak choi', '', 'Real Seeds'],
  ['Choy sum', '', 'Real Seeds'],
  ['Wong bok', '', 'Real Seeds'],
  ['Mizuna', '', 'Real Seeds'],
  ['Lettuce', 'Salad Bowl', 'Real Seeds'],
  ['Radish', 'Sparkler 3', "Mr Fothergill's"],
  ['Potato', 'Maris Bard', "Mr Fothergill's"],
  ['Potato', 'Desiree', "Mr Fothergill's"],
  ['Potato', 'Setanta', "Mr Fothergill's"],
  ['Potato', 'Charlotte', "Mr Fothergill's"],
  ['Potato', 'Maris Peer', "Mr Fothergill's"],
  ['Potato', 'Pentland Javelin', "Mr Fothergill's"],
  ['Cabbage', 'Offenham', "Mr Fothergill's"],
];

// [bed name, question]
export const SAMPLE_QUESTIONS = [
  ['Bed 7', 'Three sisters next season, or Christmas potatoes now?'],
  ['GH Bed 2', 'Broken-stem tomato: still open'],
  ['GH Bed 1', 'Watch cucumbers for spider mite'],
];
