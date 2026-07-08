export interface PreferenceRule {
    id: string;
    label: string;
    pattern: RegExp;
}

export const PREFERENCES: PreferenceRule[] = [
    {
        id: 'gym',
        label: 'Gym',
        pattern: /gym|fitness.{0,10}cent(er|re)|exercise/i,
    },
    {
        id: 'pool',
        label: 'Pool',
        pattern: /pool|swimming|jacuzzi|hot.{0,10}tub/i,
    },
    {
        id: 'spa',
        label: 'Spa',
        pattern: /spa|sauna|steam.{0,10}room/i,
    },
    {
        id: 'dishwasher',
        label: 'Dishwasher',
        pattern: /dishwasher/i,
    },
    {
        id: 'washing',
        label: 'Washing & Dryer',
        pattern: /dryer|washing.{0,10}machine/i,
    },
    {
        id: 'glazing',
        label: 'Double Glazed Windows',
        pattern: /double.{0,10}glaz|glazed.{0,10}window|soundproof/i
    },
    {
        id: 'electric-strove',
        label: 'Electric Stove',
        pattern: /(electric|induction).{0,10}(stove|cook\s?top)/i
    }
];

export const STRATA_MAX = 2000;