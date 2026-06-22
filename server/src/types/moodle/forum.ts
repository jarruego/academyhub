// Tipos de los Web Services de foros de Moodle usados por la herramienta de
// "Duplicado de Foros" (api/forum). Se mantienen tolerantes (index signature)
// porque Moodle añade campos según versión/plugins.

// Objeto foro devuelto por `mod_forum_get_forums_by_courses`.
// `id` es el id de la instancia del foro y es el `forumid` que espera
// `mod_forum_add_discussion`.
export type MoodleForum = {
    id: number;
    course: number;
    type: string;            // 'general' | 'qanda' | 'news' | 'eachuser' | 'single' | 'blog'
    name: string;
    intro: string;
    introformat?: number;
    cmid?: number;           // id del módulo de curso (para resolver el group mode si hiciera falta)
    numdiscussions?: number;
    cancreatediscussions?: boolean;
    [k: string]: unknown;
};

// Fichero embebido/adjunto referenciado por un post (de `messageinlinefiles` o
// `attachments`). `fileurl` apunta a `webservice/pluginfile.php/...` y requiere
// token para descargarse.
export type MoodleForumFile = {
    filename: string;
    fileurl: string;
    filepath?: string;
    filesize?: number;
    mimetype?: string;
    [k: string]: unknown;
};

// Post de un tema devuelto por `mod_forum_get_discussion_posts` (dentro de
// `{ posts: [...] }`). El post inicial del tema es el que tiene `parentid`/`parent`
// nulo o 0. `message` es HTML con marcadores `@@PLUGINFILE@@` para los inline.
export type MoodleForumPost = {
    id: number;
    discussionid?: number;
    discussion?: number;
    parentid?: number | null;
    parent?: number | null;
    subject: string;
    message: string;
    messageformat?: number;
    messageinlinefiles?: MoodleForumFile[];
    attachments?: MoodleForumFile[];
    [k: string]: unknown;
};

// Tema (discussion) devuelto dentro de `{ discussions: [...] }` por
// `mod_forum_get_forum_discussions`. En Moodle moderno `discussion` es el id del
// tema y `id` el del primer post; `name`/`subject` es el asunto y `groupid` el
// grupo destinatario (-1 = todos los participantes).
export type MoodleDiscussion = {
    id: number;
    discussion?: number;
    name: string;
    subject?: string;
    groupid: number;
    userid?: number;
    userfullname?: string;
    timemodified?: number;
    numreplies?: number;
    [k: string]: unknown;
};
