import type { Seed } from '../types';

/**
 * Read-only snapshot of the Notion workspace "UNI" (taken 2026-09-19).
 *
 * The Notion is the master data source and is NEVER written to. Everything in this
 * file was copied out of the public Notion pages; nothing here flows back.
 * Fields marked "app-side" (aliases) are additions of this app for search.
 *
 * `color` is app-side too. All six are taken from one scale at the same step (the "600" level of
 * a standard UI ramp), so they read as one family: equal perceptual weight, none louder than the
 * others, none neon. Hues are spread far enough apart to stay distinguishable side by side in the
 * week grid – blue / red / green / yellow / violet / slate.
 *
 * Not in Notion (therefore intentionally absent): exams, credits, grades,
 * lecture topics, which weeks a "2-wöchentlich" lecture takes place, which
 * exercise group the student attends.
 */
export const seed: Seed = {
  meta: {
    source: 'https://cut-form-38f.notion.site/UNI-e373d7cd15c883e5851381f0b2ca4d6c',
    snapshotAt: '2026-09-19',
    semester: 'Herbstsemester 2026',
  },

  courses: [
    {
      id: 'informatik-1',
      name: 'Informatik I',
      shortName: 'Informatik I',
      code: '252-0832-00',
      semester: 'Herbstsemester 2026',
      instructor: 'F. Friedrich Wicker, u. a.',
      color: '#ca8a04', // Gelb
      icon: '💻',
      aliases: ['Informatik 1', 'Info 1', 'Info1', 'Informatik', 'C++', 'CodeExpert'],
      sessions: [
        { id: 'info-v', kind: 'lecture', day: 3, start: '12:15', end: '14:00', room: 'HG E3', altRooms: ['HG E5', 'HG E7'] },
        { id: 'info-u', kind: 'exercise', day: 2, start: '08:15', end: '10:00', room: 'HG D 3.1' },
      ],
      links: [
        { label: 'CodeExpert', url: 'https://expert.ethz.ch/enrolled/AS26/mavt/exercises', kind: 'exercise' },
        { label: 'Kurswebsite', url: 'https://lec.inf.ethz.ch/mavt/informatik1/2026/', kind: 'course' },
        { label: 'Aufzeichnungen 2026', url: 'https://video.ethz.ch/lectures/d-infk/2026/autumn/252-0832-00L', kind: 'video' },
        { label: 'Aufzeichnungen 2025', url: 'https://video.ethz.ch/lectures/d-infk/2025/autumn/252-0832-00L/s/Lx2nFpP7Rs0', kind: 'video' },
      ],
    },
    {
      id: 'engineering-design',
      name: 'Engineering Design and Material Selection',
      shortName: 'Eng. Design',
      code: '151-0321-00',
      semester: 'Herbstsemester 2026',
      instructor: 'K. Shea, u. a.',
      color: '#7c3aed', // Violett – die Kontrastfarbe zwischen Blau, Rot, Gruen, Gelb, Grau
      icon: '🏗️',
      aliases: ['EDMS', 'Engineering Design', 'Material Selection', 'Materialauswahl', 'Konstruktion'],
      sessions: [
        { id: 'ed-v', kind: 'lecture', day: 1, start: '15:15', end: '16:00', room: 'HG E5', altRooms: ['HG E7', 'ML E12'] },
        { id: 'ed-u', kind: 'exercise', day: 3, start: '14:15', end: '17:00', room: 'HG E 26.1' },
      ],
      links: [
        { label: 'Moodle', url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=28176#module-1424000', kind: 'moodle' },
      ],
    },
    {
      id: 'analysis-1',
      name: 'Analysis I',
      shortName: 'Analysis I',
      code: '401-0261-00',
      semester: 'Herbstsemester 2026',
      instructor: 'A. Steiger',
      color: '#d92d20', // Rot
      icon: '📐',
      aliases: ['Analysis 1', 'Analysis1', 'Ana 1', 'Ana', 'Analysis', 'Mathe'],
      sessions: [
        { id: 'ana-v-mo', kind: 'lecture', day: 1, start: '12:15', end: '14:00', room: 'ETA F 5', altRooms: ['ETF E1'], biweekly: true },
        { id: 'ana-v-mi', kind: 'lecture', day: 3, start: '08:15', end: '10:00', room: 'ETA F 5', altRooms: ['ETF E1'] },
        { id: 'ana-v-fr', kind: 'lecture', day: 5, start: '08:15', end: '10:00', room: 'ETA F 5', altRooms: ['ETF E1'] },
        { id: 'ana-u', kind: 'exercise', day: 5, start: '10:15', end: '12:00', room: 'LEE C 114' },
      ],
      links: [],
    },
    {
      id: 'lineare-algebra-1',
      name: 'Lineare Algebra I',
      shortName: 'Lin. Algebra I',
      code: '401-0171-00',
      semester: 'Herbstsemester 2026',
      instructor: 'N. Hungerbühler',
      color: '#475569', // dunkles Schiefergrau
      icon: '🔢',
      aliases: ['Lineare Algebra 1', 'LinAlg', 'Lin Alg', 'LA1', 'LA 1', 'Linear Algebra', 'Mathe'],
      sessions: [
        { id: 'la-v', kind: 'lecture', day: 2, start: '10:15', end: '12:00', room: 'ETA F 5' },
        { id: 'la-u', kind: 'exercise', day: 5, start: '13:15', end: '14:00', room: 'CLA E 4' },
      ],
      links: [],
    },
    {
      id: 'mechanik-1',
      name: 'Mechanik I',
      shortName: 'Mechanik I',
      code: '151-0501-03',
      semester: 'Herbstsemester 2026',
      instructor: 'E. Mazza',
      color: '#2563eb', // Blau
      icon: '⚙️',
      aliases: ['Mechanik 1', 'Mechanik1', 'Mech 1', 'Mechanics', 'Statik'],
      sessions: [
        { id: 'mech-v-mo', kind: 'lecture', day: 1, start: '10:15', end: '12:00', room: 'ETA F 5', altRooms: ['ETF E1', 'HG E3'] },
        { id: 'mech-v-di', kind: 'lecture', day: 2, start: '14:15', end: '16:00', room: 'ETA F 5', altRooms: ['ETF E1', 'HG E5'] },
        { id: 'mech-u-di', kind: 'exercise', day: 2, start: '12:15', end: '13:00', room: 'NO E 11', choiceGroup: 'mechanik-uebung' },
        { id: 'mech-u-do1', kind: 'exercise', day: 4, start: '08:15', end: '10:00', room: 'LEE D 105', choiceGroup: 'mechanik-uebung' },
        { id: 'mech-u-do2', kind: 'exercise', day: 4, start: '12:15', end: '13:00', room: 'ML J 34.3', choiceGroup: 'mechanik-uebung' },
      ],
      links: [],
    },
    {
      id: 'chemistry',
      name: 'Chemistry',
      shortName: 'Chemistry',
      code: '151-0909-00',
      semester: 'Herbstsemester 2026',
      instructor: 'D. J. Norris',
      color: '#16a34a', // Gruen
      icon: '🧪',
      aliases: ['Chemie', 'Chem'],
      sessions: [
        { id: 'chem-v', kind: 'lecture', day: 4, start: '10:15', end: '12:00', room: 'ETA F 5', altRooms: ['HG E5'] },
        { id: 'chem-u', kind: 'exercise', day: 5, start: '14:15', end: '16:00', room: 'LFW C 1' },
      ],
      links: [
        { label: 'Moodle', url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=28343', kind: 'moodle' },
      ],
    },
  ],

  tasks: [
    { id: 'task-ana-serie-1', courseId: 'analysis-1', title: 'Serie 1', due: '2026-09-22T14:00', category: 'Individual', status: 'not-started' },
    { id: 'task-la-serie-1', courseId: 'lineare-algebra-1', title: 'Serie 1', due: '2026-09-22T14:00', category: 'Individual', status: 'not-started' },
    { id: 'task-chem-ps-1', courseId: 'chemistry', title: 'Problem Set 1', due: '2026-09-25T14:00', category: 'Individual', status: 'not-started' },
    { id: 'task-info-ex-1', courseId: 'informatik-1', title: 'Exercise 1', due: '2026-09-28T18:00', category: 'Individual', status: 'in-progress' },
  ],

  notes: [
    {
      id: 'informatik-cpp-basics',
      courseId: 'informatik-1',
      title: 'C++ Basics',
      sessionType: 'General',
      blocks: [
        { type: 'h2', text: 'Iostream' },
        { type: 'p', text: 'Import (ohne Semikolon):' },
        { type: 'code', text: String.raw`#include <iostream>` },
        { type: 'h3', text: 'Output' },
        {
          type: 'code',
          text: String.raw`//print to buffer:
std::cout << "";

//print to buffer w/ linebreak:
std::cout << "\n";

//flush buffer (thus output):
std::cout << std::flush;

//flush buffer with newline:
std::cout << std::endl;

//all together:
std::cout << "" << std::endl;`,
        },
        { type: 'p', text: 'Beispiel:' },
        {
          type: 'code',
          text: String.raw`int a = 5;
std::cout << "Hello World! :" << a << "Bye!" << std::endl;`,
        },
        { type: 'h3', text: 'Input' },
        { type: 'p', text: 'Input depends on variable type (eg. int 4 numbers)' },
        {
          type: 'code',
          text: String.raw`int a;
std::cin >> a; (reads 1 number, skips \n & spaces)

std::string b;
std::cin >> b; () //reads 1 word, skips \n & spaces`,
        },
        { type: 'p', text: 'Multiple Inputs' },
        {
          type: 'code',
          text: String.raw`int a, b, c;
std::cin >> a >> b >> c; //multiple inputs`,
        },
        { type: 'p', text: 'Whole line' },
        {
          type: 'code',
          text: String.raw`std::string line;
std::getline(std::cin, line); //gets everything 'til \n`,
        },
        { type: 'p', text: '! Combining « getline » & « std::cin »:' },
        {
          type: 'code',
          text: String.raw`int number;
std::cin >> number; //reads the number, but leaves \n in buffer

std::string line;
std::getline(std::cin, line); //only reads the \n -> output empty`,
        },
        { type: 'p', text: 'Solution:' },
        {
          type: 'code',
          text: String.raw`std::cin >> number;
std::cin.ignore();              //skips one zeichen
std::cin.ignore(100, "\n"); //skips 100 zeichen, or skips 'til \n
std::getline(std::cin, line);`,
        },
      ],
    },
  ],

  adminLinks: [
    {
      label: 'Bachelor Maschineningenieurwissenschaften',
      url: 'https://mavt.ethz.ch/de/studium/bachelor.html',
      description: 'Curriculum · Departement Maschinenbau und Verfahrenstechnik',
    },
    {
      label: 'Administratives',
      url: 'https://mavt.ethz.ch/de/studium/administratives.html',
      description: 'Departement Maschinenbau und Verfahrenstechnik',
    },
  ],
};
