/* =============================================================
   WorshipIEM — public-domain song library
   Real lyrics (all pre-1900 / public domain) with per-section
   durations in SECONDS. In production these come from a licensed
   lyrics API + an alignment pass; here they ship with the app so
   the timed-lyrics + arrangement features are fully demoable.
   Exposes window.DAW_HYMNS  (array)  and  window.dawFindSong(q).
   ============================================================= */
(function () {
  // section types map to colors in the app: intro/outro/verse/chorus/bridge
  const SONGS = [
    {
      id: 'itiswell',
      title: 'It Is Well With My Soul',
      artist: 'Horatio Spafford · Philip Bliss',
      year: 1873, key: 'C', bpm: 76, ts: '4/4',
      sections: [
        { name: 'Intro', type: 'intro', secs: 12, countIn: 4, lyrics: [] },
        { name: 'Verse 1', type: 'verse', secs: 33, countIn: 0, lyrics: [
          'When peace like a river attendeth my way,',
          'When sorrows like sea billows roll;',
          'Whatever my lot, Thou hast taught me to say,',
          'It is well, it is well with my soul.' ] },
        { name: 'Refrain', type: 'chorus', secs: 18, countIn: 0, voice: true, lyrics: [
          'It is well (it is well)',
          'With my soul (with my soul)',
          'It is well, it is well with my soul.' ] },
        { name: 'Verse 2', type: 'verse', secs: 33, countIn: 0, lyrics: [
          'Though Satan should buffet, though trials should come,',
          'Let this blest assurance control,',
          'That Christ hath regarded my helpless estate,',
          'And hath shed His own blood for my soul.' ] },
        { name: 'Refrain', type: 'chorus', secs: 18, countIn: 0, lyrics: [
          'It is well (it is well)',
          'With my soul (with my soul)',
          'It is well, it is well with my soul.' ] },
        { name: 'Verse 3', type: 'verse', secs: 33, countIn: 0, lyrics: [
          'My sin — oh, the bliss of this glorious thought! —',
          'My sin, not in part but the whole,',
          'Is nailed to the cross, and I bear it no more,',
          'Praise the Lord, praise the Lord, O my soul!' ] },
        { name: 'Refrain', type: 'chorus', secs: 18, countIn: 0, lyrics: [
          'It is well (it is well)',
          'With my soul (with my soul)',
          'It is well, it is well with my soul.' ] },
        { name: 'Verse 4', type: 'verse', secs: 33, countIn: 2, voice: true, lyrics: [
          'And, Lord, haste the day when my faith shall be sight,',
          'The clouds be rolled back as a scroll;',
          'The trump shall resound, and the Lord shall descend,',
          'Even so, it is well with my soul.' ] },
        { name: 'Refrain', type: 'chorus', secs: 24, countIn: 0, lyrics: [
          'It is well (it is well)',
          'With my soul (with my soul)',
          'It is well, it is well with my soul.' ] },
        { name: 'Outro', type: 'outro', secs: 14, countIn: 0, lyrics: [] },
      ],
    },
    {
      id: 'amazinggrace',
      title: 'Amazing Grace',
      artist: 'John Newton',
      year: 1779, key: 'G', bpm: 70, ts: '3/4',
      sections: [
        { name: 'Intro', type: 'intro', secs: 11, countIn: 6, lyrics: [] },
        { name: 'Verse 1', type: 'verse', secs: 30, countIn: 0, lyrics: [
          'Amazing grace! How sweet the sound',
          'That saved a wretch like me!',
          'I once was lost, but now am found;',
          'Was blind, but now I see.' ] },
        { name: 'Verse 2', type: 'verse', secs: 30, countIn: 0, lyrics: [
          "'Twas grace that taught my heart to fear,",
          'And grace my fears relieved;',
          'How precious did that grace appear',
          'The hour I first believed.' ] },
        { name: 'Verse 3', type: 'verse', secs: 30, countIn: 0, voice: true, lyrics: [
          'Through many dangers, toils and snares,',
          'I have already come;',
          "'Tis grace hath brought me safe thus far,",
          'And grace will lead me home.' ] },
        { name: 'Verse 4', type: 'verse', secs: 32, countIn: 0, lyrics: [
          "When we've been there ten thousand years,",
          'Bright shining as the sun,',
          "We've no less days to sing God's praise",
          "Than when we'd first begun." ] },
        { name: 'Outro', type: 'outro', secs: 12, countIn: 0, lyrics: [] },
      ],
    },
    {
      id: 'comethoufount',
      title: 'Come Thou Fount of Every Blessing',
      artist: 'Robert Robinson',
      year: 1758, key: 'D', bpm: 72, ts: '4/4',
      sections: [
        { name: 'Intro', type: 'intro', secs: 10, countIn: 4, lyrics: [] },
        { name: 'Verse 1', type: 'verse', secs: 34, countIn: 0, lyrics: [
          'Come, Thou Fount of every blessing,',
          'Tune my heart to sing Thy grace;',
          'Streams of mercy, never ceasing,',
          'Call for songs of loudest praise.' ] },
        { name: 'Verse 2', type: 'verse', secs: 34, countIn: 0, lyrics: [
          'Here I raise mine Ebenezer;',
          'Hither by Thy help I\u2019m come;',
          'And I hope, by Thy good pleasure,',
          'Safely to arrive at home.' ] },
        { name: 'Verse 3', type: 'verse', secs: 36, countIn: 0, voice: true, lyrics: [
          'O to grace how great a debtor',
          'Daily I\u2019m constrained to be!',
          'Let Thy goodness, like a fetter,',
          'Bind my wandering heart to Thee.' ] },
        { name: 'Outro', type: 'outro', secs: 12, countIn: 0, lyrics: [] },
      ],
    },
    {
      id: 'holyholyholy',
      title: 'Holy, Holy, Holy',
      artist: 'Reginald Heber',
      year: 1826, key: 'D', bpm: 80, ts: '4/4',
      sections: [
        { name: 'Intro', type: 'intro', secs: 9, countIn: 4, lyrics: [] },
        { name: 'Verse 1', type: 'verse', secs: 30, countIn: 0, lyrics: [
          'Holy, holy, holy! Lord God Almighty!',
          'Early in the morning our song shall rise to Thee;',
          'Holy, holy, holy! Merciful and mighty,',
          'God in three Persons, bless\u00e8d Trinity!' ] },
        { name: 'Verse 2', type: 'verse', secs: 30, countIn: 0, voice: true, lyrics: [
          'Holy, holy, holy! All the saints adore Thee,',
          'Casting down their golden crowns around the glassy sea;',
          'Cherubim and seraphim falling down before Thee,',
          'Which wert, and art, and evermore shalt be.' ] },
        { name: 'Outro', type: 'outro', secs: 11, countIn: 0, lyrics: [] },
      ],
    },
  ];

  window.DAW_HYMNS = SONGS;
  window.dawFindSong = function (q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return SONGS;
    return SONGS.filter(s => (s.title + ' ' + s.artist).toLowerCase().includes(q));
  };
  window.dawSongById = function (id) { return SONGS.find(s => s.id === id) || SONGS[0]; };
})();
