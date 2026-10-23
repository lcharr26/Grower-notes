// Ready-made gardens that can be loaded in one tap instead of set up by hand.
// They load as ordinary gardens: everything can be edited afterwards, and the
// app itself never depends on any of this.

export const PRESETS = {
  derby: {
    label: 'Derby walled kitchen garden',
    site: {
      name: 'Derby walled kitchen garden',
      location: 'Derby, UK',
      last_frost: '05-10', // rough local averages: edit in Settings > Garden details
      first_frost: '10-20',
    },
    beds: [
      ['greenhouse', ['GH Bed 1', 'GH Bed 2', 'GH Bed 3', 'GH Bed 4', 'Potting bench']],
      ['outdoor', ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Bed 5', 'Bed 6', 'Bed 7']],
      ['informal', ['Strawberry bed', 'Herb/perennial beds', 'Ornamental beds', 'Field kitchen']],
    ],
    // [crop, variety, supplier]
    varieties: [
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
    ],
    // [bed name, question]. Yes/no wherever possible: one tap to answer.
    questions: [
      ['Bed 7', 'Christmas potatoes in Bed 7 now? (No = three sisters next season)'],
      ['GH Bed 2', 'Has the broken-stem tomato recovered?'],
      ['GH Bed 1', 'Any spider mite on the cucumbers?'],
    ],
    // Earlier wordings, so questions already on a phone can be updated.
    reworded: {
      'Three sisters next season, or Christmas potatoes now?': 'Christmas potatoes in Bed 7 now? (No = three sisters next season)',
      'Broken-stem tomato: still open': 'Has the broken-stem tomato recovered?',
      'Watch cucumbers for spider mite': 'Any spider mite on the cucumbers?',
    },
  },
};
