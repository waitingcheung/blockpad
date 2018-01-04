var Delta = Quill.import('delta');

$(document).ready(function () {
    var quill = new Quill('#editor', {
        theme: 'snow'
    });

    quill.clipboard.addMatcher(Node.TEXT_NODE, function (node, delta) {
        return new Delta().insert(node.data);
    });

    $.getJSON('blocks', function (data) {
        if (data.chain.length > 1) {
            var latestBlock = data.chain[data.chain.length - 1];
            var content = JSON.parse(latestBlock.data).content;
            $('.ql-editor').html(content);
        }
    });

    $.getJSON('websocketPort', function (data) {
        var loc = window.location, websocketURL;
        if (loc.protocol === "https:") {
            websocketURL = "wss:";
        } else {
            websocketURL = "ws:";
        }
        websocketURL += "//" + loc.hostname + ':' + data.port;

        var ws = new WebSocket(websocketURL);
        ws.onmessage = function (event) {
            var message = JSON.parse(event.data);
            if (message.type === 2) {
                var receivedBlock = JSON.parse(message.data.substring(1, message.data.length - 1));
                var blockData = JSON.parse(receivedBlock.data);
                var content = blockData.content;

                var range = quill.getSelection();
                quill.clipboard.dangerouslyPasteHTML(content);
                quill.setSelection(range);
            }
        }
    });

    quill.on('text-change', function (delta, oldDelta, source) {
        if (source === 'api') {
            console.log("An API call triggered this change.");
        } else if (source === 'user') {
            $.post('mineBlock', {
                "data": JSON.stringify(
                    {
                        "content": $('.ql-editor').html(),
                        "delta": delta
                    }
                )
            });
            console.log("A user action triggered this change.");
        }
    });
});
